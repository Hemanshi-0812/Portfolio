// ============================================
// Portfolio Website JavaScript
// ============================================
// Admin Mode Instructions:
// 1. Open the site with ?admin=true (e.g. https://yoursite.com/?admin=true)
// 2. The Edit button and edit mode features will only appear while the URL includes ?admin=true.
// 3. Normal visitors (without ?admin=true) will never see or access edit mode.
// 4. To disable admin mode, remove the ?admin=true parameter or run: disableAdminMode() in the browser console.
// 5. To check status, run: checkAdminStatus().
//
// NOTE: This is intentionally a "secret" URL toggle; do not share it publicly.
// Change the password in the ADMIN_PASSWORD constant above (if you want to use it with custom code).
// ============================================

// ============================================
// Global Variables
// ============================================
const PORTFOLIO_STORAGE_KEY = 'portfolioData';
const PORTFOLIO_DATA_VERSION = 1; // Increment when schema changes
const ADMIN_STORAGE_KEY = 'portfolioAdminAuth';
const ADMIN_PASSWORD = 'portfolio2024'; // Change this to a secure password you control

let portfolioData = {};
const currentTheme = localStorage.getItem('theme') || 'light';
let isAdminMode = false; // Flag to track if admin mode is enabled

// ============================================
// Test EmailJS Setup (call from browser console)
// ============================================
function testEmailJS() {
    console.log('=== EmailJS Test ===');
    console.log('EmailJS Ready:', emailjsReady);
    console.log('Public Key Set:', '6WKP_8Te0fHgU8RoJ' !== 'YOUR_PUBLIC_KEY_HERE');
    console.log('Service ID Set:', 'service_z46vo33' !== 'YOUR_SERVICE_ID_HERE');
    console.log('Template ID Set:', 'template_zq45k5c' !== 'YOUR_TEMPLATE_ID_HERE');

    if (!emailjsReady) {
        console.error('❌ EmailJS not ready. Please check your credentials.');
        return false;
    }

    console.log('✅ EmailJS appears to be configured correctly.');
    console.log('Try submitting the contact form to test email sending.');
    return true;
}

// Make test function available globally
window.testEmailJS = testEmailJS;

// Function to check admin status (call from console)
function checkAdminStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminUrl = urlParams.get('admin') === 'true';

    console.log('[Portfolio] Admin Mode:', isAdminMode ? 'ENABLED' : 'DISABLED');
    console.log('[Portfolio] Admin URL param:', isAdminUrl ? 'PRESENT' : 'NOT PRESENT');
    console.log('[Portfolio] Admin auth stored:', localStorage.getItem(ADMIN_STORAGE_KEY) ? 'YES' : 'NO');
    return isAdminMode;
}

// ============================================
// Check Admin Access
// ============================================
function checkAdminAccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminUrl = urlParams.get('admin') === 'true';

    // Admin mode is only enabled when the exact query parameter ?admin=true is present.
    // This prevents normal visitors from seeing the Edit button or entering edit mode.
    isAdminMode = isAdminUrl;

    if (isAdminMode) {
        // Persist state for quick refreshes while the URL has ?admin=true.
        localStorage.setItem(ADMIN_STORAGE_KEY, 'true');
        console.log('[Portfolio] Admin URL detected - edit mode enabled.');
    } else {
        // Clear stored auth to avoid accidental access if the admin parameter is removed.
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        console.log('[Portfolio] Admin mode disabled (no admin query parameter).');
    }

    return isAdminMode;
}

// Enable admin mode (for console use)
function enableAdminMode(password) {
    if (!password) {
        console.warn('[Portfolio] enableAdminMode requires a password: enableAdminMode("YOUR_PASSWORD")');
        return false;
    }

    if (password === ADMIN_PASSWORD) {
        localStorage.setItem(ADMIN_STORAGE_KEY, 'true');
        isAdminMode = true;
        initializeEditMode();
        console.log('[Portfolio] Admin mode enabled via enableAdminMode().');
        return true;
    }

    console.warn('[Portfolio] Invalid admin password.');
    return false;
}

// Disable admin mode (clears stored auth)
function disableAdminMode() {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    isAdminMode = false;
    initializeEditMode();
    console.log('[Portfolio] Admin mode disabled.');
}

// Make admin helpers globally accessible
window.enableAdminMode = enableAdminMode;
window.disableAdminMode = disableAdminMode;
window.checkAdminStatus = checkAdminStatus;

// ============================================
// Initialize on Page Load
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    showLoading();
    checkAdminAccess(); // Check if admin mode should be enabled
    loadPortfolioData();
    initializeTheme();
    setupEventListeners();
    setupObserver();
    initializeEditMode();
    initializeResume();
});

// ============================================
// Loading Animation
// ============================================
function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        setTimeout(() => {
            loading.classList.add('hidden');
            setTimeout(() => {
                loading.style.display = 'none';
            }, 500);
        }, 1500); // Show loading for 1.5 seconds
    }
}

// ============================================
// Utilities for portfolio data merging
// ============================================
function mergeDeep(base, override) {
    if (!base || typeof base !== 'object') return override;
    if (!override || typeof override !== 'object') return base;

    // If it's an array, prefer override (full replacement) unless override is empty
    if (Array.isArray(base) && Array.isArray(override)) {
        return override.length ? override : base;
    }

    const merged = { ...base };
    Object.keys(override).forEach(key => {
        if (base.hasOwnProperty(key)) {
            merged[key] = mergeDeep(base[key], override[key]);
        } else {
            merged[key] = override[key];
        }
    });
    return merged;
}

// Load default portfolio data (from JSON file or built-in defaults)
async function loadDefaultPortfolioData() {
    try {
        const response = await fetch('js/data.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to fetch data.json (status: ${response.status})`);
        const data = await response.json();
        console.log('[Portfolio] Loaded baseline data from js/data.json.');
        return data;
    } catch (error) {
        console.warn('[Portfolio] Could not load js/data.json, using built-in defaults.', error);
        return getDefaultData();
    }
}

// ============================================
// Load Portfolio Data from localStorage or JSON
// ============================================
async function loadPortfolioData() {
    console.log('[Portfolio] Loading portfolio data...');

    // Allow forcing defaults (for debugging or after deployment), e.g. ?reset=true
    const urlParams = new URLSearchParams(window.location.search);
    const resetFlag = urlParams.get('reset');
    if (resetFlag === 'true') {
        console.log('[Portfolio] Reset flag detected - clearing saved portfolio data.');
        localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
    }

    // Load baseline data (from JSON/defaults)
    const baseData = await loadDefaultPortfolioData();
    let usedSavedData = false;

    // First, check if there's saved data in localStorage
    const savedDataRaw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (savedDataRaw && savedDataRaw !== 'null') {
        console.log('[Portfolio] Found saved data in localStorage.');
        try {
            const parsed = JSON.parse(savedDataRaw);

            // Prefer versioned data format
            let savedData;
            if (parsed && parsed.version && parsed.data) {
                savedData = parsed.data;
                console.log('[Portfolio] Loaded saved data (version', parsed.version, ') from localStorage.');

                if (parsed.version !== PORTFOLIO_DATA_VERSION) {
                    console.log('[Portfolio] Saved data version', parsed.version, 'does not match current version', PORTFOLIO_DATA_VERSION, '. Keeping saved data but merging defaults where needed.');
                }
            } else {
                // Backwards compatible: older format where data was saved directly
                savedData = parsed;
                console.log('[Portfolio] Loaded saved data (legacy format) from localStorage.');
            }

            // Merge with defaults to prevent missing sections
            portfolioData = mergeDeep(baseData, savedData);
            usedSavedData = true;
        } catch (error) {
            console.error('[Portfolio] Error parsing saved data from localStorage:', error);
            // Clear invalid saved data so it does not keep failing on every load
            localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
        }
    }

    if (!usedSavedData) {
        portfolioData = baseData;
    }

    populatePortfolio();
    setupTypingAnimation(); // Setup typing animation with loaded data

    if (usedSavedData) {
        console.log('[Portfolio] Portfolio loaded using saved localStorage data.');
    } else {
        console.log('[Portfolio] Portfolio loaded using default data.');
    }
}

// ============================================
// Default Data Fallback
// ============================================
function getDefaultData() {
    return {
        personal: {
            name: 'John Doe',
            title: 'Full Stack Developer',
            heroDescription: 'Creative developer passionate about building beautiful and functional web applications.',
            description: 'Creative developer passionate about building beautiful and functional web applications.',
            interests: [
                'Web Development',
                'UI/UX Design',
                'Open Source Contribution',
                'Continuous Learning'
            ]
        },
        skills: [
            {
                category: 'Programming',
                items: [
                    { name: 'JavaScript', proficiency: 90 },
                    { name: 'HTML/CSS', proficiency: 85 },
                    { name: 'React', proficiency: 85 },
                    { name: 'Node.js', proficiency: 80 }
                ]
            },
            {
                category: 'Tools',
                items: [
                    { name: 'Git', proficiency: 85 },
                    { name: 'VS Code', proficiency: 90 },
                    { name: 'Figma', proficiency: 75 },
                    { name: 'Docker', proficiency: 70 }
                ]
            },
            {
                category: 'Soft Skills',
                items: [
                    { name: 'Communication', proficiency: 85 },
                    { name: 'Problem Solving', proficiency: 90 },
                    { name: 'Teamwork', proficiency: 88 },
                    { name: 'Project Management', proficiency: 80 }
                ]
            }
        ],
        projects: [
            {
                title: 'E-Commerce Platform',
                description: 'A full-stack e-commerce solution with payment integration.',
                technologies: ['React', 'Node.js', 'MongoDB', 'Stripe'],
                github: '#',
                demo: '#',
                emoji: '🛍️'
            },
            {
                title: 'Task Management App',
                description: 'Collaborative task management application with real-time updates.',
                technologies: ['React', 'Firebase', 'Tailwind CSS'],
                github: '#',
                demo: '#',
                emoji: '✅'
            },
            {
                title: 'Weather Dashboard',
                description: 'Real-time weather dashboard with interactive maps.',
                technologies: ['JavaScript', 'API', 'Chart.js'],
                github: '#',
                demo: '#',
                emoji: '🌤️'
            }
        ],
        education: [
            {
                year: '2021 - 2023',
                degree: 'Bachelor of Science',
                institution: 'Tech University',
                description: 'Computer Science with focus on Web Development'
            },
            {
                year: '2020 - 2021',
                degree: 'Web Development Bootcamp',
                institution: 'Code Academy',
                description: 'Intensive 12-week bootcamp covering full-stack development'
            },
            {
                year: '2019 - 2020',
                degree: 'High School Diploma',
                institution: 'Central High School',
                description: 'Advanced Computer Science courses'
            }
        ],
        achievements: [
            {
                title: 'AWS Certified Developer',
                issuer: 'Amazon Web Services',
                year: '2023',
                emoji: '🏆'
            },
            {
                title: 'Google UX Design Certificate',
                issuer: 'Google',
                year: '2022',
                emoji: '🎓'
            },
            {
                title: 'React Specialization',
                issuer: 'Coursera',
                year: '2022',
                emoji: '⭐'
            },
            {
                title: 'Hackathon Winner',
                issuer: 'Tech Hackathon 2023',
                year: '2023',
                emoji: '🥇'
            }
        ],
        designWork: [
            {
                title: 'Branding Design',
                category: 'Poster',
                description: 'Creative branding poster for a tech startup',
                media: 'assets/images/design-work/branding.jpg',
                type: 'image'
            },
            {
                title: 'Canva Designs',
                category: 'Card',
                description: 'Modern business card designs created with Canva',
                media: 'assets/images/design-work/canva-designs.jpg',
                type: 'image'
            },
            {
                title: 'Digital Art',
                category: 'Modern Image',
                description: 'Digital artwork featuring abstract concepts',
                media: 'assets/images/design-work/digital-art.jpg',
                type: 'image'
            },
            {
                title: 'Templates',
                category: 'Poster',
                description: 'Reusable design templates for various purposes',
                media: 'assets/images/design-work/templates.jpg',
                type: 'image'
            }
        ],
        social: [
            {
                name: 'LinkedIn',
                url: 'https://linkedin.com',
                icon: '💼'
            },
            {
                name: 'GitHub',
                url: 'https://github.com',
                icon: '🐙'
            },
            {
                name: 'Email',
                url: 'mailto:your-email@example.com',
                icon: '📧'
            },
            {
                name: 'Twitter',
                url: 'https://twitter.com',
                icon: '🐦'
            }
        ]
    };
}

// ============================================
// Populate Portfolio with Data
// ============================================
function populatePortfolio() {
    populateHero();
    populateAbout();
    populateSkills();
    populateProjects();
    populateEducation();
    populateAchievements();
    populateDesignWork();
    populateSocial();
    populateContact();
}

function populateHero() {
    const heroTitle = document.querySelector('.hero-title');
    const typingText = document.getElementById('typingText');
    const heroDescription = document.querySelector('.hero-description');

    if (heroTitle) {
        heroTitle.textContent = portfolioData.personal?.name || 'Hi, I\'m Hemanshi Bhayani';
    }

    if (typingText) {
        typingText.textContent = portfolioData.personal?.title || 'Computer Engineering Student';
    }

    if (heroDescription) {
        heroDescription.textContent = portfolioData.personal?.heroDescription || 'Passionate about coding, technology, and creating beautiful designs with Canva';
    }
}

function populateAbout() {
    const aboutDesc = document.getElementById('aboutDescription');
    const interestsList = document.getElementById('interests');

    if (aboutDesc) {
        aboutDesc.textContent = portfolioData.personal?.description || '';
    }

    if (interestsList) {
        interestsList.innerHTML = (portfolioData.personal?.interests || [])
            .map(interest => `<li>${interest}</li>`)
            .join('');
    }
}

function populateSkills() {
    const skillsContainer = document.getElementById('skillsContainer');
    if (!skillsContainer) return;

    skillsContainer.innerHTML = (portfolioData.skills || [])
        .map(category => `
            <div class="skill-category">
                <h3 data-editable="true">${category.category}</h3>
                ${category.items.map(skill => `
                    <div class="skill-item">
                        <div class="skill-name">
                            <span data-editable="true">${skill.name}</span>
                            <span>${skill.proficiency}%</span>
                        </div>
                        <div class="skill-bar">
                            <div class="skill-progress" style="width: ${skill.proficiency}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
}

function populateProjects() {
    const projectsGrid = document.getElementById('projectsGrid');
    if (!projectsGrid) return;

    projectsGrid.innerHTML = (portfolioData.projects || [])
        .map(project => `
            <div class="project-card">
                <div class="project-image" data-editable="true">${project.emoji || '📱'}</div>
                <div class="project-content">
                    <h3 class="project-title" data-editable="true">${project.title}</h3>
                    <p class="project-description" data-editable="true">${project.description}</p>
                    <div class="project-tech">
                        ${project.technologies.map(tech => `
                            <span class="tech-tag" data-editable="true">${tech}</span>
                        `).join('')}
                    </div>
                    <div class="project-links">
                        <a href="${project.github}" class="btn btn-primary" target="_blank">GitHub</a>
                        <a href="${project.demo}" class="btn btn-secondary" target="_blank">Demo</a>
                    </div>
                </div>
            </div>
        `).join('');
}

function populateEducation() {
    const timeline = document.getElementById('educationTimeline');
    if (!timeline) return;

    timeline.innerHTML = (portfolioData.education || [])
        .map((edu, index) => `
            <div class="timeline-item" style="animation-delay: ${index * 0.1}s">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-year" data-editable="true">${edu.year}</div>
                    <div class="timeline-title" data-editable="true">${edu.degree}</div>
                    <div style="color: var(--primary-color); font-weight: 600; margin-bottom: 0.5rem;" data-editable="true">
                        ${edu.institution}
                    </div>
                    <div class="timeline-description" data-editable="true">${edu.description}</div>
                </div>
            </div>
        `).join('');
}

function populateAchievements() {
    const achievementsGrid = document.getElementById('achievementsGrid');
    if (!achievementsGrid) return;

    achievementsGrid.innerHTML = (portfolioData.achievements || [])
        .map((achievement, index) => `
            <div class="achievement-card" style="animation-delay: ${index * 0.1}s">
                <div class="achievement-icon" data-editable="true">${achievement.emoji || '🏅'}</div>
                <div class="achievement-title" data-editable="true">${achievement.title}</div>
                <div class="achievement-issuer" data-editable="true">${achievement.issuer}</div>
                <div class="achievement-year" data-editable="true">${achievement.year}</div>
            </div>
        `).join('');
}

function populateDesignWork() {
    const designGallery = document.getElementById('designGallery');
    if (!designGallery) return;

    const isEditMode = document.body.classList.contains('edit-mode');

    // Preserve existing controls if they exist
    const existingControls = designGallery.querySelector('.design-controls');

    const designItemsHTML = (portfolioData.designWork || [])
        .map((design, index) => `
            <div class="design-item ${isEditMode ? 'editable-design-item' : ''}" onclick="${isEditMode ? '' : `openDesignLightbox(${index})`}" style="animation-delay: ${index * 0.1}s">
                <div class="design-media" data-design-index="${index}">
                    ${isEditMode ? `
                        <div class="design-preview-header" style="background-image: ${design.uploadedImage ? `url('${design.uploadedImage}')` : 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))'}">
                            ${!design.uploadedImage ? `<div class="design-placeholder-text">${design.title || 'Design Preview'}</div>` : ''}
                        </div>
                    ` : (design.type === 'video' 
                        ? `<video src="${design.media}" muted></video>` 
                        : `<img src="${design.media}" alt="${design.title}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22><rect fill=%22%236366f1%22 width=%22400%22 height=%22400%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2230%22 fill=%22white%22>${design.title}</text></svg>'">`
                    )}
                </div>
                <div class="design-info">
                    ${isEditMode ? `
                        <div class="design-upload-section">
                            <button class="upload-image-btn" onclick="triggerDesignImageUpload(this)">
                                <span class="upload-icon">📤</span> Upload Image
                            </button>
                            <input type="file" class="design-image-input" accept="image/jpeg,image/png" style="display: none;" onchange="handleDesignImageUpload(event, this)">
                        </div>
                        <input type="text" class="design-title-input" value="${design.title}" placeholder="Design Title">
                        <select class="design-category-select">
                            <option value="Poster" ${design.category === 'Poster' ? 'selected' : ''}>Poster</option>
                            <option value="Card" ${design.category === 'Card' ? 'selected' : ''}>Card</option>
                            <option value="Modern Image" ${design.category === 'Modern Image' ? 'selected' : ''}>Modern Image</option>
                            <option value="Other" ${design.category === 'Other' ? 'selected' : ''}>Other</option>
                        </select>
                        <textarea class="design-description-input" placeholder="Design description">${design.description}</textarea>
                    ` : `
                        <h3 class="design-title">${design.title}</h3>
                        <span class="design-category">${design.category}</span>
                        <p class="design-description">${design.description}</p>
                    `}
                </div>
                ${isEditMode ? `
                    <div class="design-controls">
                        <button class="control-btn success" onclick="updateDesignItem(${index}, this)">Update</button>
                        <button class="control-btn danger" onclick="deleteDesignItem(${index})">Delete</button>
                    </div>
                ` : `
                    <div class="design-overlay">
                        <div class="design-overlay-text">
                            <span class="view-text">View ${design.title}</span>
                            <span class="category-badge">${design.category}</span>
                        </div>
                    </div>
                `}
            </div>
        `).join('');

    // Set the innerHTML and re-append controls if they existed
    designGallery.innerHTML = designItemsHTML;
    if (existingControls) {
        designGallery.appendChild(existingControls);
    }
}

function populateSocial() {
    const socialLinks = document.getElementById('socialLinks');
    if (!socialLinks) return;

    socialLinks.innerHTML = (portfolioData.social || [])
        .map(social => `
            <a href="${social.url}" class="social-icon" title="${social.name}" target="_blank" data-editable="true">
                ${social.icon}
            </a>
        `).join('');
}
function populateContact() {
    const contactEmail = document.getElementById('contactEmail');
    const contactPhone = document.getElementById('contactPhone');
    const contactLinkedIn = document.getElementById('contactLinkedIn');
    const contactLocation = document.getElementById('contactLocation');

    if (contactEmail && portfolioData.contact?.email) {
        contactEmail.textContent = portfolioData.contact.email;
    }
    if (contactPhone && portfolioData.contact?.phone) {
        contactPhone.textContent = portfolioData.contact.phone;
    }
    if (contactLinkedIn && portfolioData.contact?.linkedin) {
        contactLinkedIn.textContent = portfolioData.contact.linkedin;
    }
    if (contactLocation && portfolioData.contact?.location) {
        contactLocation.textContent = portfolioData.contact.location;
    }
}


// ============================================
// Theme Toggle
// ============================================
function initializeTheme() {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');

    if (currentTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        updateThemeIcon();
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const html = document.documentElement;
    const theme = html.getAttribute('data-theme');
    const themeIcon = document.querySelector('.theme-icon');

    if (theme === 'dark') {
        themeIcon.textContent = '🌙';
    } else {
        themeIcon.textContent = '☀️';
    }
}

// ============================================
// Navigation & Hamburger Menu
// ============================================
function setupEventListeners() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Hamburger menu toggle
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu?.classList.toggle('active');
        });
    }

    // Close menu when link is clicked
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            hamburger?.classList.remove('active');
            navMenu?.classList.remove('active');
        });
    });
}

// ============================================
// Typing Animation
// ============================================
function setupTypingAnimation() {
    const typingText = document.getElementById('typingText');
    if (!typingText) return;

    // Use the title from portfolioData, or fallback to default roles
    const title = portfolioData.personal?.title || 'Computer Engineering Student';
    const roles = [title]; // For now, just use the single title

    let currentRole = 0;
    let charIndex = 0;
    let isDeleting = false;

    function type() {
        const currentText = roles[currentRole];

        if (isDeleting) {
            charIndex--;
        } else {
            charIndex++;
        }

        typingText.textContent = currentText.substring(0, charIndex);

        let delay = isDeleting ? 50 : 100;

        if (!isDeleting && charIndex === currentText.length) {
            delay = 2000; // Pause before deleting
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            currentRole = (currentRole + 1) % roles.length;
            delay = 500;
        }

        setTimeout(type, delay);
    }

    type();
}

// ============================================
// Intersection Observer for Animations
// ============================================
function setupObserver() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe sections for scroll animations
    document.querySelectorAll('section').forEach(section => {
        if (section.id !== 'home') {
            section.classList.add('fade-in-section');
            observer.observe(section);
        }
    });

    // Observe project cards
    document.querySelectorAll('.project-card, .achievement-card, .design-item').forEach(el => {
        observer.observe(el);
    });
}

// ============================================
// Lightbox Gallery
// ============================================
function openLightbox(imageSrc) {
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImage');
    if (modal && img) {
        img.src = imageSrc;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function openDesignLightbox(index) {
    const design = portfolioData.designWork[index];
    if (!design) return;

    const modal = document.getElementById('lightboxModal');
    const mediaContainer = document.getElementById('lightboxMedia');
    const title = document.getElementById('lightboxTitle');
    const category = document.getElementById('lightboxCategory');
    const description = document.getElementById('lightboxDescription');

    if (modal && mediaContainer && title && category && description) {
        // Clear previous content
        mediaContainer.innerHTML = '';

        // Add media
        if (design.type === 'video') {
            const video = document.createElement('video');
            video.src = design.media;
            video.controls = true;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '100%';
            mediaContainer.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = design.media;
            img.alt = design.title;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            mediaContainer.appendChild(img);
        }

        // Add info
        title.textContent = design.title;
        category.textContent = design.category;
        description.textContent = design.description;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeLightbox() {
    const modal = document.getElementById('lightboxModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// Lightbox event listeners
document.getElementById('lightboxModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'lightboxModal') {
        closeLightbox();
    }
});

document.querySelector('.lightbox-close')?.addEventListener('click', closeLightbox);

// ============================================
// Resume Preview
// ============================================
function previewResume() {
    const preview = document.getElementById('resumePreview');
    const iframe = document.getElementById('resumeIframe');

    if (preview && iframe) {
        const storedResume = localStorage.getItem('portfolioResume');

        if (storedResume) {
            try {
                const resumeData = JSON.parse(storedResume);
                iframe.src = resumeData.data;
                preview.style.display = 'block';
            } catch (error) {
                console.error('Error loading stored resume:', error);
                showResumeMessage('Error loading resume. Please upload again.');
            }
        } else {
            // Check if traditional resume.txt exists
            fetch('assets/resume.txt')
                .then(response => {
                    if (response.ok) {
                        window.open('assets/resume.txt', '_blank');
                    } else {
                        showResumeMessage('No resume found. Please upload a resume first.');
                    }
                })
                .catch(error => {
                    console.error('Error loading resume:', error);
                    showResumeMessage('No resume found. Please upload a resume first.');
                });
        }
    }
}

// ============================================
// Resume Upload Functionality
// ============================================
function uploadResume() {
    const fileInput = document.getElementById('resumeFileInput');
    const file = fileInput?.files[0];

    if (!file) {
        alert('Please select a PDF file first.');
        return;
    }

    if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB.');
        return;
    }

    // Convert file to Base64 and store
    const reader = new FileReader();
    reader.onload = function(event) {
        const base64Data = event.target.result;

        // Store resume data in localStorage
        const resumeData = {
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64Data,
            uploadedAt: new Date().toISOString()
        };

        localStorage.setItem('portfolioResume', JSON.stringify(resumeData));

        // Update download button
        updateResumeDownloadLink();

        // Show preview
        showResumePreview(base64Data);

        showSaveMessage('Resume uploaded and saved successfully!');
    };

    reader.onerror = function() {
        alert('Error reading file. Please try again.');
    };

    reader.readAsDataURL(file);
}

// Update download link with stored resume data
function updateResumeDownloadLink() {
    const downloadBtn = document.getElementById('downloadResumeBtn');
    const storedResume = localStorage.getItem('portfolioResume');

    if (storedResume && downloadBtn) {
        try {
            const resumeData = JSON.parse(storedResume);
            downloadBtn.style.display = 'inline-block';
            downloadBtn.onclick = function(e) {
                e.preventDefault();
                downloadResume();
            };
        } catch (error) {
            console.error('Error parsing stored resume:', error);
            downloadBtn.style.display = 'none';
        }
    } else {
        downloadBtn.style.display = 'none';
    }
}

// Download resume from stored Base64 data
function downloadResume() {
    const storedResume = localStorage.getItem('portfolioResume');

    if (!storedResume) {
        alert('No resume found. Please upload a resume first.');
        return;
    }

    try {
        const resumeData = JSON.parse(storedResume);

        // Convert Base64 back to blob
        const base64Data = resumeData.data.split(',')[1]; // Remove data URL prefix
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: resumeData.type });

        // Create download link
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = resumeData.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL object
        URL.revokeObjectURL(downloadUrl);

    } catch (error) {
        console.error('Error downloading resume:', error);
        alert('Error downloading resume. Please try again.');
    }
}

// Show resume preview from Base64 data
function showResumePreview(base64Data) {
    const preview = document.getElementById('resumePreview');
    const iframe = document.getElementById('resumeIframe');

    if (preview && iframe && base64Data) {
        iframe.src = base64Data;
        preview.style.display = 'block';
    }
}

// Initialize resume functionality on page load
function initializeResume() {
    updateResumeDownloadLink();

    // Check for stored resume and show preview if available
    const storedResume = localStorage.getItem('portfolioResume');
    if (storedResume) {
        try {
            const resumeData = JSON.parse(storedResume);
            showResumePreview(resumeData.data);
        } catch (error) {
            console.error('Error loading stored resume:', error);
        }
    }
}

function showResumeMessage(message) {
    const resumeContent = document.querySelector('.resume-content');
    if (resumeContent) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'resume-message';
        messageDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; background-color: var(--bg-secondary); border-radius: 10px; margin-top: 2rem;">
                <p style="color: var(--text-dark); font-size: 1.1rem;">${message}</p>
                <p style="color: var(--text-dark); opacity: 0.7; margin-top: 1rem;">You can download a sample resume or create your own PDF resume.</p>
            </div>
        `;
        resumeContent.appendChild(messageDiv);

        // Remove message after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// ============================================
// EmailJS Setup Instructions (for developers)
// ============================================
// To make the contact form work, follow these steps:
//
// 1. Go to https://www.emailjs.com/
// 2. Create a free account
// 3. Add an email service (Gmail, Outlook, Yahoo, etc.)
// 4. Create an email template with these variables:
//    - {{from_name}} (sender's name)
//    - {{from_email}} (sender's email)
//    - {{message}} (message content)
// 5. Get your:
//    - Public Key (from Account > General)
//    - Service ID (from Email Services)
//    - Template ID (from Email Templates)
// 6. Replace the EMAILJS_CONFIG values below
//
// Example template:
// Subject: New message from {{from_name}}
// Body: Hi there! You have a new message from {{from_name}} ({{from_email}}):
//
// {{message}}
//
// Best regards,
// Your Portfolio Contact Form
//
// ============================================

const EMAILJS_CONFIG = {
    // ==== REPLACE THESE WITH YOUR EmailJS CREDENTIALS ==== //
    // Get these from your EmailJS dashboard (https://dashboard.emailjs.com).
    //   1) Public Key: Account > General > Public Key
    //   2) Service ID: Email Services > [your service] > Service ID
    //   3) Template ID: Email Templates > [your template] > Template ID
    // Example:
    //   PUBLIC_KEY: "user_abcd1234"
    //   SERVICE_ID: "service_xxx123"
    //   TEMPLATE_ID: "template_yyy456"
    //
    // Replace the placeholder strings below with your real values.
    PUBLIC_KEY: 'YOUR_REAL_PUBLIC_KEY',     // <-- paste your Public Key here
    SERVICE_ID: 'YOUR_REAL_SERVICE_ID',     // <-- paste your Service ID here
    TEMPLATE_ID: 'YOUR_REAL_TEMPLATE_ID'    // <-- paste your Template ID here
};

// ============================================
// EmailJS Initialization
// ============================================
let emailjsReady = false;

function initEmailJS() {
    // Ensure the EmailJS script is loaded (the <script> tag is included in index.html)
    if (typeof emailjs === 'undefined') {
        console.error('EmailJS library is not loaded. Make sure the EmailJS CDN script is included before main.js.');
        emailjsReady = false;
        return;
    }

    const hasValidCredentials =
        EMAILJS_CONFIG.PUBLIC_KEY &&
        EMAILJS_CONFIG.SERVICE_ID &&
        EMAILJS_CONFIG.TEMPLATE_ID &&
        !EMAILJS_CONFIG.PUBLIC_KEY.startsWith('YOUR_') &&
        !EMAILJS_CONFIG.SERVICE_ID.startsWith('YOUR_') &&
        !EMAILJS_CONFIG.TEMPLATE_ID.startsWith('YOUR_');

    if (!hasValidCredentials) {
        console.warn('⚠️ EmailJS is not configured. Please update EMAILJS_CONFIG in js/main.js with your Public Key, Service ID, and Template ID.');
        emailjsReady = false;
        return;
    }

    try {
        // Initialize EmailJS with your Public Key
        emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
        emailjsReady = true;
        console.log('✅ EmailJS initialized successfully!');
    } catch (error) {
        console.error('❌ Failed to initialize EmailJS:', error);
        emailjsReady = false;
    }
}

// Initialize EmailJS when the page loads
initEmailJS();

// ============================================
// Contact Form Validation & Submission
// ============================================
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get form values
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const message = document.getElementById('message').value.trim();

        // Validate form
        let isValid = true;

        // Name validation
        if (!name) {
            showError('nameError', 'Name is required');
            isValid = false;
        } else {
            clearError('nameError');
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            showError('emailError', 'Email is required');
            isValid = false;
        } else if (!emailRegex.test(email)) {
            showError('emailError', 'Please enter a valid email address');
            isValid = false;
        } else {
            clearError('emailError');
        }

        // Message validation
        if (!message) {
            showError('messageError', 'Message is required');
            isValid = false;
        } else {
            clearError('messageError');
        }

        if (!isValid) return;

        // Ensure EmailJS is initialized before sending
        if (!emailjsReady) {
            showErrorMessage(
                '⚠️ Email service is not configured. Please add your EmailJS Public Key, Service ID, and Template ID to js/main.js (see comments near EMAILJS_CONFIG).'
            );
            return;
        }

        // Show loading state
        const submitButton = contactForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Sending...';
        submitButton.disabled = true;

        try {
            // Send email using EmailJS sendForm method
            console.log('Sending email via EmailJS...');
            const result = await emailjs.sendForm(
                EMAILJS_CONFIG.SERVICE_ID,
                EMAILJS_CONFIG.TEMPLATE_ID,
                contactForm
            );

            console.log('Email sent successfully:', result);
            showSuccessMessage(name);
            contactForm.reset();

        } catch (error) {
            console.error('EmailJS error details:', error);

            // Provide specific error messages based on error type
            let errorMessage = 'Failed to send message. ';
            if (error.text) {
                errorMessage += error.text;
            } else if (error.message) {
                errorMessage += error.message;
            } else {
                errorMessage += 'Please try again or contact directly.';
            }

            showErrorMessage(errorMessage);
        } finally {
            // Reset button
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    });
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
    }
}

function clearError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
    }
}

// ============================================
// Contact Form Message Functions
// ============================================

function showSuccessMessage(name) {
    const successMessage = `
Thank you for your message, ${name}! 🎉

Your message has been sent successfully! I'll get back to you as soon as possible.

📧 Email: hemanshibhayani81@gmail.com
📱 Phone: +91-9313792431
💼 LinkedIn: linkedin.com/in/hemanshibhayani

You can also reach out directly using the contact information above.
    `;

    // Create a styled notification instead of alert
    showNotification(successMessage, 'success');
}

function showErrorMessage(customMessage = null) {
    const errorMessage = customMessage || `
❌ Oops! Something went wrong.

Your message couldn't be sent at the moment. Please try again later or contact me directly:

📧 Email: hemanshibhayani81@gmail.com
📱 Phone: +91-9313792431
💼 LinkedIn: linkedin.com/in/hemanshibhayani
    `;

    // Create a styled notification instead of alert
    showNotification(errorMessage, 'error');
}

function showNotification(message, type) {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.form-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `form-notification ${type}`;
    notification.innerHTML = message.replace(/\n/g, '<br>');

    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '100px',
        right: '20px',
        maxWidth: '400px',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: 'var(--shadow-lg)',
        zIndex: '1001',
        fontSize: '14px',
        lineHeight: '1.6',
        animation: 'slideInRight 0.3s ease-out'
    });

    // Set colors based on type
    if (type === 'success') {
        notification.style.backgroundColor = 'var(--primary-color)';
        notification.style.color = 'white';
        notification.style.border = '2px solid var(--primary-color)';
    } else {
        notification.style.backgroundColor = '#dc2626';
        notification.style.color = 'white';
        notification.style.border = '2px solid #dc2626';
    }

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 8 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }
    }, 8000);

    // Add click to dismiss
    notification.addEventListener('click', () => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    });
}

// ============================================
// Smooth Scrolling for Navigation Links
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        // Prevent default only for valid section links
        if (href !== '#' && document.querySelector(href)) {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
});

// ============================================
// Navbar Background on Scroll
// ============================================
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        if (window.scrollY > 50) {
            navbar.style.boxShadow = 'var(--shadow-lg)';
        } else {
            navbar.style.boxShadow = 'var(--shadow)';
        }
    }
});

// ============================================
// Keyboard shortcuts
// ============================================
document.addEventListener('keydown', (e) => {
    // Escape key closes lightbox
    if (e.key === 'Escape') {
        closeLightbox();
    }
});

// ============================================
// Edit Mode Functionality
// ============================================
let isEditMode = false;

// Initialize edit mode
function initializeEditMode() {
    const editToggles = Array.from(document.querySelectorAll('#editToggle'));
    const editToggle = editToggles[0];
    const saveButton = document.getElementById('saveButton');

    // Ensure there is only one edit button in the DOM (prevents "Edit Edit" or duplicates).
    if (editToggles.length > 1) {
        console.warn('[Portfolio] Multiple edit toggle buttons found; keeping the first and removing duplicates.');
        editToggles.slice(1).forEach(btn => btn.remove());
    }

    console.log('[Portfolio] initializeEditMode() - admin mode is', isAdminMode ? 'ENABLED' : 'DISABLED');

    // Ensure edit mode is not active if admin access is not granted.
    if (!isAdminMode && isEditMode) {
        isEditMode = false;
        document.body.classList.remove('edit-mode');
    }

    if (editToggle) {
        // Avoid adding duplicate click handlers when initializeEditMode is called multiple times.
        editToggle.removeEventListener('click', toggleEditMode);

        if (isAdminMode) {
            editToggle.style.display = 'inline-flex'; // Show the edit button
            editToggle.addEventListener('click', toggleEditMode);
        } else {
            editToggle.style.display = 'none';
        }
    }

    if (saveButton) {
        saveButton.removeEventListener('click', saveChanges);
        saveButton.style.display = isAdminMode && isEditMode ? 'inline-block' : 'none';
        if (isAdminMode) {
            saveButton.addEventListener('click', saveChanges);
        }
    }

    // Load saved data from localStorage is now handled in loadPortfolioData
}

// Toggle edit mode
function toggleEditMode() {
    isEditMode = !isEditMode;
    const body = document.body;
    const editToggle = document.getElementById('editToggle');
    const saveButton = document.getElementById('saveButton');

    if (isEditMode) {
        body.classList.add('edit-mode');
        editToggle.querySelector('.edit-text').textContent = 'Exit Edit';
        editToggle.setAttribute('data-short-text', 'Exit');
        saveButton.style.display = 'inline-block';
        enableEditing();
    } else {
        body.classList.remove('edit-mode');
        editToggle.querySelector('.edit-text').textContent = 'Edit Portfolio';
        editToggle.setAttribute('data-short-text', 'Edit');
        saveButton.style.display = 'none';
        disableEditing();
    }
}

// Trigger image upload
function triggerImageUpload() {
    const imageUploadInput = document.getElementById('designImageUploadInput');
    if (imageUploadInput) {
        imageUploadInput.click();
    }
}

// Handle image upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;

        // Create new design item
        const designGallery = document.getElementById('designGallery');
        if (!designGallery) return;

        const newDesign = document.createElement('div');
        newDesign.className = 'design-item editable-design-item';
        newDesign.innerHTML = `
            <div class="design-media">
                <img src="${imageData}" alt="New Design">
            </div>
            <div class="design-info">
                <input type="text" class="design-title-input" placeholder="Design Title" value="New Design">
                <select class="design-category-select">
                    <option value="Poster">Poster</option>
                    <option value="Card">Card</option>
                    <option value="Modern Image">Modern Image</option>
                    <option value="Other">Other</option>
                </select>
                <textarea class="design-description-input" placeholder="Design description">Description of your design work</textarea>
            </div>
            <div class="design-controls">
                <button class="control-btn success" onclick="saveDesignItem(this)">Save</button>
                <button class="control-btn danger" onclick="removeDesignItem(this)">Remove</button>
            </div>
        `;

        // Insert before controls
        const controls = designGallery.querySelector('.design-controls');
        if (controls) {
            designGallery.insertBefore(newDesign, controls);
        } else {
            designGallery.appendChild(newDesign);
        }

        // Clear the input
        event.target.value = '';
    };
    reader.readAsDataURL(file);
}

// Trigger design image upload for individual design items
function triggerDesignImageUpload(button) {
    // Find the file input within the same design item
    const designItem = button.closest('.design-item');
    const fileInput = designItem.querySelector('.design-image-input');
    if (fileInput) {
        fileInput.click();
    }
}

// Handle design image upload for individual design items
function handleDesignImageUpload(event, inputElement) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPG or PNG).');
        return;
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;

        // Find the design item and update the preview
        const designItem = inputElement.closest('.design-item');
        const previewHeader = designItem.querySelector('.design-preview-header');
        const placeholderText = previewHeader.querySelector('.design-placeholder-text');

        if (previewHeader && placeholderText) {
            // Update the background image
            previewHeader.style.backgroundImage = `url('${imageData}')`;
            // Hide the placeholder text
            placeholderText.style.display = 'none';

            // Store the image data temporarily in the design item for saving later
            designItem.dataset.uploadedImage = imageData;
        }
    };
    reader.readAsDataURL(file);
}

// Enable editing for all content
function enableEditing() {
    // Make text content editable
    const editableElements = document.querySelectorAll('[data-editable]');
    editableElements.forEach(el => {
        el.contentEditable = 'true';
        el.classList.add('editable');
    });

    // Make form inputs editable
    const inputs = document.querySelectorAll('input[data-editable], textarea[data-editable]');
    inputs.forEach(input => {
        input.removeAttribute('readonly');
        input.classList.add('editable');
    });

    // Show resume upload section in edit mode
    const resumeUploadSection = document.getElementById('resumeUploadSection');
    if (resumeUploadSection) {
        resumeUploadSection.style.display = 'block';
    }

    // Refresh design gallery for edit mode
    populateDesignWork();

    // Add controls for arrays
    addArrayControls();

    // Add skill sliders
    addSkillSliders();
}

// Disable editing
function disableEditing() {
    // Remove contentEditable
    const editableElements = document.querySelectorAll('[contenteditable="true"]');
    editableElements.forEach(el => {
        el.contentEditable = 'false';
        el.classList.remove('editable');
    });

    // Make form inputs readonly
    const inputs = document.querySelectorAll('input[data-editable], textarea[data-editable]');
    inputs.forEach(input => {
        input.setAttribute('readonly', 'true');
        input.classList.remove('editable');
    });

    // Hide resume upload section when not in edit mode
    const resumeUploadSection = document.getElementById('resumeUploadSection');
    if (resumeUploadSection) {
        resumeUploadSection.style.display = 'none';
    }

    // Remove array controls
    removeArrayControls();

    // Refresh design gallery for normal mode
    populateDesignWork();

    // Remove skill sliders
    removeSkillSliders();
}

// Add controls for array items (skills, projects, etc.)
function addArrayControls() {
    // Skills
    const skillCategories = document.querySelectorAll('.skill-category');
    skillCategories.forEach(category => {
        const controls = document.createElement('div');
        controls.className = 'skill-controls';
        controls.innerHTML = `
            <button class="add-item-btn" onclick="addSkillItem(this)">Add Skill</button>
        `;
        category.appendChild(controls);
    });

    // Projects
    const projectsGrid = document.getElementById('projectsGrid');
    if (projectsGrid) {
        const controls = document.createElement('div');
        controls.className = 'project-controls';
        controls.innerHTML = `
            <div class="control-buttons">
                <button class="control-btn success" onclick="addProject()">Add Project</button>
            </div>
        `;
        projectsGrid.appendChild(controls);
    }

    // Achievements
    const achievementsGrid = document.getElementById('achievementsGrid');
    if (achievementsGrid) {
        const controls = document.createElement('div');
        controls.className = 'achievement-controls';
        controls.innerHTML = `
            <div class="control-buttons">
                <button class="control-btn success" onclick="addAchievement()">Add Achievement</button>
            </div>
        `;
        achievementsGrid.appendChild(controls);
    }

    // Education
    const educationTimeline = document.getElementById('educationTimeline');
    if (educationTimeline) {
        const controls = document.createElement('div');
        controls.className = 'education-controls';
        controls.innerHTML = `
            <div class="control-buttons">
                <button class="control-btn success" onclick="addEducation()">Add Education</button>
            </div>
        `;
        educationTimeline.appendChild(controls);
    }

    // Design Work
    const designGallery = document.getElementById('designGallery');
    if (designGallery) {
        const controls = document.createElement('div');
        controls.className = 'design-controls';
        controls.innerHTML = `
            <div class="control-buttons">
                <button class="control-btn success" onclick="addDesignWork()">Add Design</button>
            </div>
        `;
        designGallery.appendChild(controls);
    }
}

// Remove array controls
function removeArrayControls() {
    document.querySelectorAll('.skill-controls, .project-controls, .achievement-controls, .education-controls, .design-controls').forEach(el => el.remove());
}

// Add skill sliders
function addSkillSliders() {
    const skillItems = document.querySelectorAll('.skill-item');
    skillItems.forEach(item => {
        const skillName = item.querySelector('.skill-name span:first-child');
        const skillValue = item.querySelector('.skill-name span:last-child');
        const skillBar = item.querySelector('.skill-progress');

        if (skillName && skillValue && skillBar) {
            const currentValue = parseInt(skillValue.textContent) || 0;
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '0';
            slider.max = '100';
            slider.value = currentValue;
            slider.className = 'skill-slider';

            const valueDisplay = document.createElement('span');
            valueDisplay.className = 'skill-value';
            valueDisplay.textContent = currentValue + '%';

            slider.addEventListener('input', (e) => {
                const value = e.target.value;
                valueDisplay.textContent = value + '%';
                skillBar.style.width = value + '%';
                skillValue.textContent = value + '%';
            });

            const controls = item.parentElement.querySelector('.skill-controls') || item.parentElement;
            controls.appendChild(slider);
            controls.appendChild(valueDisplay);
        }
    });
}

// Remove skill sliders
function removeSkillSliders() {
    document.querySelectorAll('.skill-slider, .skill-value').forEach(el => el.remove());
}

// Add edit indicators
// Array manipulation functions
function addSkillItem(button) {
    const category = button.closest('.skill-category');
    const skillsContainer = category.querySelector('.skill-category > div') || category;
    const newSkill = document.createElement('div');
    newSkill.className = 'skill-item editable-array-item';
    newSkill.innerHTML = `
        <div class="skill-name">
            <span contenteditable="true" data-editable="true">New Skill</span>
            <span>50%</span>
        </div>
        <div class="skill-bar">
            <div class="skill-progress" style="width: 50%"></div>
        </div>
        <button class="control-btn danger" onclick="removeArrayItem(this)">Remove</button>
    `;
    skillsContainer.appendChild(newSkill);
}

function addProject() {
    const projectsGrid = document.getElementById('projectsGrid');
    const newProject = document.createElement('div');
    newProject.className = 'project-card editable-array-item';
    newProject.innerHTML = `
        <div class="project-image" contenteditable="true" data-editable="true">📱</div>
        <div class="project-content">
            <h3 class="project-title" contenteditable="true" data-editable="true">New Project</h3>
            <p class="project-description" contenteditable="true" data-editable="true">Project description</p>
            <div class="project-tech">
                <span class="tech-tag" contenteditable="true" data-editable="true">Technology</span>
            </div>
            <button class="control-btn danger" onclick="removeArrayItem(this)">Remove</button>
        </div>
    `;
    projectsGrid.insertBefore(newProject, projectsGrid.lastElementChild);
}

function addAchievement() {
    const achievementsGrid = document.getElementById('achievementsGrid');
    const newAchievement = document.createElement('div');
    newAchievement.className = 'achievement-card editable-array-item';
    newAchievement.innerHTML = `
        <div class="achievement-icon" contenteditable="true" data-editable="true">🏆</div>
        <div class="achievement-title" contenteditable="true" data-editable="true">New Achievement</div>
        <div class="achievement-issuer" contenteditable="true" data-editable="true">Issuer</div>
        <div class="achievement-year" contenteditable="true" data-editable="true">2024</div>
        <button class="control-btn danger" onclick="removeArrayItem(this)">Remove</button>
    `;
    achievementsGrid.insertBefore(newAchievement, achievementsGrid.lastElementChild);
}

function addEducation() {
    const timeline = document.getElementById('educationTimeline');
    const newEducation = document.createElement('div');
    newEducation.className = 'timeline-item editable-array-item';
    newEducation.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content">
            <div class="timeline-year" contenteditable="true" data-editable="true">2024</div>
            <div class="timeline-title" contenteditable="true" data-editable="true">New Degree</div>
            <div style="color: var(--primary-color); font-weight: 600; margin-bottom: 0.5rem;" contenteditable="true" data-editable="true">Institution</div>
            <div class="timeline-description" contenteditable="true" data-editable="true">Description</div>
            <button class="control-btn danger" onclick="removeArrayItem(this)">Remove</button>
        </div>
    `;
    timeline.insertBefore(newEducation, timeline.lastElementChild);
}

function addDesignWork() {
    const designGallery = document.getElementById('designGallery');
    const newDesign = document.createElement('div');
    newDesign.className = 'design-item editable-design-item';
    newDesign.innerHTML = `
        <div class="design-media">
            <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect fill='%236366f1' width='400' height='400'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='white'>Click to upload</text></svg>" alt="New Design">
            <input type="file" class="design-file-input" accept="image/*,video/mp4" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;">
        </div>
        <div class="design-info">
            <input type="text" class="design-title-input" placeholder="Design Title" value="New Design">
            <select class="design-category-select">
                <option value="Poster">Poster</option>
                <option value="Card">Card</option>
                <option value="Modern Image">Modern Image</option>
                <option value="Other">Other</option>
            </select>
            <textarea class="design-description-input" placeholder="Design description">Description of your design work</textarea>
        </div>
        <div class="design-controls">
            <button class="control-btn success" onclick="saveDesignItem(this)">Save</button>
            <button class="control-btn danger" onclick="removeDesignItem(this)">Remove</button>
        </div>
    `;

    // Add click handler for media upload
    const mediaDiv = newDesign.querySelector('.design-media');
    const fileInput = newDesign.querySelector('.design-file-input');
    const img = newDesign.querySelector('img');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (file.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.src = event.target.result;
                    video.muted = true;
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.objectFit = 'cover';
                    mediaDiv.replaceChild(video, img);
                } else {
                    img.src = event.target.result;
                }
            };
            reader.readAsDataURL(file);
        }
    });

    designGallery.insertBefore(newDesign, designGallery.lastElementChild);
}

function saveDesignItem(button) {
    const item = button.closest('.editable-design-item');
    if (!item) return;

    const title = item.querySelector('.design-title-input').value;
    const category = item.querySelector('.design-category-select').value;
    const description = item.querySelector('.design-description-input').value;
    const mediaElement = item.querySelector('img, video');
    const fileInput = item.querySelector('.design-file-input');

    if (!title) {
        alert('Please provide a title.');
        return;
    }

    if (!mediaElement || mediaElement.src.includes('Click to upload')) {
        alert('Please upload an image or video first.');
        return;
    }

    // Get media data
    let mediaData = mediaElement.src;
    let mediaType = mediaElement.tagName === 'VIDEO' ? 'video' : 'image';

    // Add to portfolioData
    const newDesign = {
        title: title,
        category: category,
        description: description,
        media: mediaData,
        type: mediaType
    };

    if (!portfolioData.designWork) portfolioData.designWork = [];
    portfolioData.designWork.push(newDesign);

    // Save to localStorage
    saveChanges();

    // Remove the editable item and refresh display
    item.remove();
    populateDesignWork();

    showMessage('Design item saved successfully!');
}

function removeDesignItem(button) {
    const item = button.closest('.editable-design-item');
    if (item) {
        item.remove();
    }
}

function updateDesignItem(index, button) {
    const item = button.closest('.design-item');
    const title = item.querySelector('.design-title-input').value;
    const category = item.querySelector('.design-category-select').value;
    const description = item.querySelector('.design-description-input').value;

    if (!title) {
        alert('Please provide a title.');
        return;
    }

    // Get the uploaded image data if it exists
    const uploadedImage = item.dataset.uploadedImage;

    // Update the data
    portfolioData.designWork[index] = {
        ...portfolioData.designWork[index],
        title: title,
        category: category,
        description: description,
        uploadedImage: uploadedImage || portfolioData.designWork[index].uploadedImage
    };

    // Save to localStorage
    saveChanges();

    // Refresh display
    populateDesignWork();

    showMessage('Design item updated successfully!');
}

function deleteDesignItem(index) {
    if (confirm('Are you sure you want to delete this design item?')) {
        portfolioData.designWork.splice(index, 1);
        saveChanges();
        populateDesignWork();
        showMessage('Design item deleted successfully!');
    }
}

// Save changes to localStorage
function saveChanges() {
    const editedData = {
        contact: {
            email: document.getElementById('contactEmail')?.textContent || 'hemanshibhayani81@gmail.com',
            phone: document.getElementById('contactPhone')?.textContent || '+91-9313792431',
            linkedin: document.getElementById('contactLinkedIn')?.textContent || 'linkedin.com/in/hemanshibhayani',
            location: document.getElementById('contactLocation')?.textContent || 'Rajkot, Gujarat, India'
        },
        personal: {
            name: document.querySelector('.hero-title')?.textContent || portfolioData.personal?.name,
            title: document.getElementById('typingText')?.textContent || portfolioData.personal?.title,
            heroDescription: document.querySelector('.hero-description')?.textContent || portfolioData.personal?.heroDescription,
            description: document.getElementById('aboutDescription')?.textContent || portfolioData.personal?.description,
            interests: Array.from(document.querySelectorAll('#interests li')).map(li => li.textContent)
        },
        skills: getEditedSkills(),
        projects: getEditedProjects(),
        education: getEditedEducation(),
        achievements: getEditedAchievements(),
        designWork: getEditedDesignWork(),
        social: getEditedSocial()
    };

    // Save to localStorage (versioned format)
    const stored = {
        version: PORTFOLIO_DATA_VERSION,
        data: editedData
    };
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(stored));
    console.log('[Portfolio] Saved data to localStorage (version', PORTFOLIO_DATA_VERSION, ').');

    // Update global data
    portfolioData = editedData;

    // Show success message
    showSaveMessage('Changes saved successfully!');

    // Exit edit mode
    toggleEditMode();
}

// Helper functions to extract edited data
function getEditedSkills() {
    const categories = document.querySelectorAll('.skill-category');
    return Array.from(categories).map(category => {
        const categoryName = category.querySelector('h3')?.textContent || 'Category';
        const skillItems = category.querySelectorAll('.skill-item');
        const items = Array.from(skillItems).map(item => {
            const name = item.querySelector('.skill-name span:first-child')?.textContent || 'Skill';
            const proficiency = parseInt(item.querySelector('.skill-name span:last-child')?.textContent) || 0;
            return { name, proficiency };
        });
        return { category: categoryName, items };
    });
}

function getEditedProjects() {
    const projectCards = document.querySelectorAll('.project-card');
    return Array.from(projectCards).map(card => {
        const title = card.querySelector('.project-title')?.textContent || 'Project';
        const description = card.querySelector('.project-description')?.textContent || 'Description';
        const technologies = Array.from(card.querySelectorAll('.tech-tag')).map(tag => tag.textContent);
        const emoji = card.querySelector('.project-image')?.textContent || '📱';
        return {
            title,
            description,
            technologies,
            github: '#',
            demo: '#',
            emoji
        };
    });
}

function getEditedEducation() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    return Array.from(timelineItems).map(item => {
        const year = item.querySelector('.timeline-year')?.textContent || 'Year';
        const degree = item.querySelector('.timeline-title')?.textContent || 'Degree';
        const institution = item.querySelector('.timeline-content > div:nth-child(3)')?.textContent || 'Institution';
        const description = item.querySelector('.timeline-description')?.textContent || 'Description';
        return { year, degree, institution, description };
    });
}

function getEditedAchievements() {
    const achievementCards = document.querySelectorAll('.achievement-card');
    return Array.from(achievementCards).map(card => {
        const title = card.querySelector('.achievement-title')?.textContent || 'Achievement';
        const issuer = card.querySelector('.achievement-issuer')?.textContent || 'Issuer';
        const year = card.querySelector('.achievement-year')?.textContent || 'Year';
        const emoji = card.querySelector('.achievement-icon')?.textContent || '🏆';
        return { title, issuer, year, emoji };
    });
}

function getEditedDesignWork() {
    // Since design work is managed dynamically, return the current data
    return portfolioData.designWork || [];
}

function getEditedSocial() {
    const socialIcons = document.querySelectorAll('.social-icon');
    return Array.from(socialIcons).map(icon => {
        const name = icon.title || 'Social';
        const url = icon.href || '#';
        const iconText = icon.textContent || '🔗';
        return { name, url, icon: iconText };
    });
}

function showSaveMessage(message) {
    const notification = document.createElement('div');
    notification.className = 'save-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: var(--success-color, #10b981);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 1001;
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(-100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
