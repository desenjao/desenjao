// metricas.js - Sistema de métricas e analytics

class MetricasTracker {
    constructor() {
        this.metrics = {
            startTime: performance.now(),
            pageLoadTime: null,
            sectionsViewed: new Set(),
            scrollDepth: {
                25: false, 50: false, 75: false, 90: false
            },
            timeOnPage: 0,
            interactions: {
                totalClicks: 0,
                serviceClicks: {},
                formInteractions: 0
            },
            deviceInfo: this.getDeviceInfo()
        };

        this.initTimeTracker();
        this.initScrollTracking();
        this.initClickTracking();
        this.initSectionTracking();
        this.initPerformanceTracking();
    }

    // ==================== UTILITÁRIOS ====================
    getDeviceInfo() {
        return {
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,
            device_pixel_ratio: window.devicePixelRatio,
            user_agent: navigator.userAgent.substring(0, 100),
            language: navigator.language
        };
    }

    // ==================== PERFORMANCE ====================
    initPerformanceTracking() {
        // Core Web Vitals
        window.addEventListener('load', () => {
            this.metrics.pageLoadTime = Math.round(performance.now() - this.metrics.startTime);
            
            // LCP (Largest Contentful Paint)
            const lcpObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.sendGAEvent('web_vital', 'LCP', Math.round(lastEntry.renderTime || lastEntry.loadTime));
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

            // FID (First Input Delay)
            const fidObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                entries.forEach(entry => {
                    this.sendGAEvent('web_vital', 'FID', Math.round(entry.processingStart - entry.startTime));
                });
            });
            fidObserver.observe({ entryTypes: ['first-input'] });

            // CLS (Cumulative Layout Shift)
            let clsValue = 0;
            let clsEntries = [];
            const clsObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                        clsEntries.push(entry);
                    }
                }
                this.sendGAEvent('web_vital', 'CLS', Math.round(clsValue * 1000));
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });

            this.sendGAEvent('page_load', 'Performance', this.metrics.pageLoadTime, {
                load_time: this.metrics.pageLoadTime,
                non_interaction: true
            });
        });

        // Memory usage (se suportado)
        if (performance.memory) {
            setInterval(() => {
                this.sendGAEvent('memory_usage', 'Performance', performance.memory.usedJSHeapSize / 1024 / 1024, {
                    used_mb: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total_mb: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    non_interaction: true
                });
            }, 30000);
        }
    }

    // ==================== SCROLL TRACKING ====================
    initScrollTracking() {
        let scrollTimeout;
        let lastScrollY = window.scrollY;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            const scrollDirection = currentScrollY > lastScrollY ? 'down' : 'up';
            lastScrollY = currentScrollY;

            // Track scroll depth percentage
            const scrollPercent = Math.round((currentScrollY + window.innerHeight) / document.documentElement.scrollHeight * 100);
            
            Object.keys(this.metrics.scrollDepth).forEach(depth => {
                if (scrollPercent >= parseInt(depth) && !this.metrics.scrollDepth[depth]) {
                    this.metrics.scrollDepth[depth] = true;
                    
                    this.sendGAEvent('scroll_depth', 'Engajamento', parseInt(depth), {
                        scroll_percentage: scrollPercent,
                        scroll_direction: scrollDirection
                    });
                }
            });

            // Debounced scroll event
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.sendGAEvent('scroll_interaction', 'Engajamento', currentScrollY, {
                    scroll_y: currentScrollY,
                    scroll_percentage: scrollPercent,
                    scroll_direction: scrollDirection
                });
            }, 500);
        });
    }

    // ==================== CLICK TRACKING ====================
    initClickTracking() {
        document.addEventListener('click', (e) => {
            this.metrics.interactions.totalClicks++;
            
            const target = e.target;
            const elementType = target.tagName.toLowerCase();
            const elementText = target.textContent?.trim().substring(0, 50) || '';
            
            // Track WhatsApp buttons
            if (target.closest('.js-whatsapp')) {
                const btn = target.closest('.js-whatsapp');
                const serviceName = btn.closest('.service-card')?.querySelector('h3')?.textContent || 'Geral';
                
                this.metrics.interactions.serviceClicks[serviceName] = 
                    (this.metrics.interactions.serviceClicks[serviceName] || 0) + 1;
                
                this.sendGAEvent('click_whatsapp', 'Conversão', 1, {
                    service_name: serviceName,
                    button_text: elementText,
                    total_clicks: this.metrics.interactions.totalClicks
                });
            }
            
            // Track internal links
            if (target.closest('a[href^="#"]')) {
                const href = target.getAttribute('href');
                this.sendGAEvent('click_internal_link', 'Navegação', 1, {
                    link_target: href,
                    link_text: elementText
                });
            }
            
            // Track buttons
            if (elementType === 'button' || target.closest('button')) {
                this.sendGAEvent('click_button', 'Interação', 1, {
                    button_text: elementText,
                    element_type: elementType
                });
            }
        }, true); // Use capture phase
    }

    // ==================== SECTION TRACKING ====================
    initSectionTracking() {
        const sections = document.querySelectorAll('section[id]');
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
                    const sectionId = entry.target.id;
                    const sectionName = entry.target.querySelector('h2')?.textContent || sectionId;
                    const timeInView = Math.round(performance.now() - this.metrics.startTime);
                    
                    if (!this.metrics.sectionsViewed.has(sectionId)) {
                        this.metrics.sectionsViewed.add(sectionId);
                        
                        this.sendGAEvent('view_section', 'Engajamento', timeInView, {
                            section_id: sectionId,
                            section_name: sectionName,
                            time_to_view: timeInView,
                            sections_viewed: this.metrics.sectionsViewed.size,
                            total_sections: sections.length
                        });
                    }
                }
            });
        }, {
            threshold: [0.3, 0.6, 0.9],
            rootMargin: '0px 0px -100px 0px'
        });

        sections.forEach(section => sectionObserver.observe(section));
    }

    // ==================== TIME TRACKING ====================
    initTimeTracker() {
        // Track time on page
        let activeTime = 0;
        let lastActiveTime = Date.now();
        let isActive = true;

        const updateActiveTime = () => {
            if (isActive) {
                const now = Date.now();
                activeTime += now - lastActiveTime;
                lastActiveTime = now;
            }
        };

        const setActive = () => {
            isActive = true;
            lastActiveTime = Date.now();
        };

        const setInactive = () => {
            updateActiveTime();
            isActive = false;
        };

        // Update every 10 seconds
        setInterval(() => {
            updateActiveTime();
            this.metrics.timeOnPage = Math.round(activeTime / 1000);
            
            // Send time update every 30 seconds
            if (this.metrics.timeOnPage % 30 === 0) {
                this.sendGAEvent('time_on_page', 'Engajamento', this.metrics.timeOnPage, {
                    seconds_on_page: this.metrics.timeOnPage,
                    sections_viewed: this.metrics.sectionsViewed.size,
                    non_interaction: true
                });
            }
        }, 10000);

        // Track visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                setInactive();
            } else {
                setActive();
            }
        });

        // Track user activity
        ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
            document.addEventListener(event, setActive, { passive: true });
        });
    }

    // ==================== GA4 INTEGRATION ====================
    sendGAEvent(eventName, category, value = 1, extraParams = {}) {
        if (typeof gtag !== 'function') {
            console.warn('GA4 não carregado:', eventName);
            return;
        }

        const defaultParams = {
            event_category: category,
            event_label: eventName,
            value: value,
            timestamp: Date.now(),
            ...this.metrics.deviceInfo,
            ...extraParams
        };

        try {
            gtag('event', eventName, defaultParams);
            
            // Debug no console
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('📊 GA4 Event:', eventName, defaultParams);
            }
        } catch (error) {
            console.error('Erro ao enviar evento GA4:', error);
        }
    }

    // ==================== ERROR TRACKING ====================
    initErrorTracking() {
        // JavaScript errors
        window.addEventListener('error', (e) => {
            this.sendGAEvent('js_error', 'Erro', 1, {
                error_message: e.message.substring(0, 100),
                error_file: e.filename,
                error_line: e.lineno,
                error_col: e.colno,
                non_interaction: true
            });
        });

        // Promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.sendGAEvent('promise_rejection', 'Erro', 1, {
                error_reason: e.reason?.toString().substring(0, 100),
                non_interaction: true
            });
        });

        // Resource loading errors
        window.addEventListener('error', (e) => {
            if (e.target && (e.target.tagName === 'IMG' || e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK')) {
                this.sendGAEvent('resource_error', 'Erro', 1, {
                    resource_type: e.target.tagName,
                    resource_src: e.target.src || e.target.href,
                    non_interaction: true
                });
            }
        }, true);
    }

    // ==================== PUBLIC METHODS ====================
    getMetrics() {
        return {
            ...this.metrics,
            timeOnPage: this.metrics.timeOnPage,
            scrollDepthPercentage: this.getCurrentScrollDepth(),
            sectionsViewedCount: this.metrics.sectionsViewed.size
        };
    }

    getCurrentScrollDepth() {
        const scrollY = window.scrollY;
        const docHeight = document.documentElement.scrollHeight;
        const winHeight = window.innerHeight;
        return Math.round((scrollY + winHeight) / docHeight * 100);
    }

    trackCustomEvent(eventName, params = {}) {
        this.sendGAEvent(eventName, 'Custom', 1, params);
    }
}

// ==================== INITIALIZATION ====================
let metricasInstance = null;

function initMetricas() {
    if (metricasInstance) return metricasInstance;
    
    try {
        metricasInstance = new MetricasTracker();
        metricasInstance.initErrorTracking();
        
        // Send page_view event
        setTimeout(() => {
            metricasInstance.sendGAEvent('page_view', 'Navegação', 1, {
                page_title: document.title,
                page_path: window.location.pathname,
                non_interaction: true
            });
        }, 1000);

        // Expose globally para debug
        if (window.location.hostname === 'localhost') {
            window.$metricas = metricasInstance;
        }
        
        return metricasInstance;
    } catch (error) {
        console.error('Erro ao inicializar métricas:', error);
        return null;
    }
}

// Auto-initialize quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMetricas);
} else {
    initMetricas();
}

// Export para módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MetricasTracker, initMetricas };
}