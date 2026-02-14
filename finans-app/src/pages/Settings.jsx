import { useState } from 'react';
import {
    User,
    Bell,
    Shield,
    Palette,
    Globe,
    CreditCard,
    HelpCircle,
    LogOut,
    ChevronRight,
    Moon,
    Sun,
    Check
} from 'lucide-react';
import './Settings.css';

const settingsSections = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'language', name: 'Language & Region', icon: Globe },
    { id: 'billing', name: 'Billing', icon: CreditCard },
    { id: 'help', name: 'Help & Support', icon: HelpCircle },
];

const currencies = ['USD', 'EUR', 'TRY', 'GBP'];
const languages = ['English', 'Turkish', 'Deutsch', 'Español'];

function getInitialTheme() {
    try {
        return localStorage.getItem('finans_theme') || 'dark';
    } catch {
        return 'dark';
    }
}

function applyTheme(theme) {
    const resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : theme;
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem('finans_theme', theme);
}

export default function Settings() {
    const [activeSection, setActiveSection] = useState('profile');
    const [theme, setTheme] = useState(getInitialTheme);
    const [currency, setCurrency] = useState('USD');
    const [language, setLanguage] = useState('English');
    const [notifications, setNotifications] = useState({
        priceAlerts: true,
        newsDigest: true,
        portfolioUpdates: true,
        marketOpen: false,
        weeklyReport: true,
    });

    const handleNotificationChange = (key) => {
        setNotifications({ ...notifications, [key]: !notifications[key] });
    };

    return (
        <div className="settings-page">
            {/* Settings Sidebar */}
            <aside className="settings-sidebar fade-in">
                <nav className="settings-nav">
                    {settingsSections.map((section) => (
                        <button
                            key={section.id}
                            className={`settings-nav-item ${activeSection === section.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(section.id)}
                        >
                            <section.icon size={18} />
                            <span>{section.name}</span>
                            <ChevronRight size={16} className="nav-arrow" />
                        </button>
                    ))}
                </nav>
                <div className="settings-footer">
                    <button className="logout-btn">
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Settings Content */}
            <main className="settings-content fade-in" style={{ animationDelay: '0.1s' }}>
                {activeSection === 'profile' && (
                    <section className="settings-section">
                        <h2 className="section-title">Profile Settings</h2>
                        <p className="section-description">Manage your account information and preferences.</p>

                        <div className="profile-header">
                            <div className="avatar-section">
                                <div className="avatar-large">
                                    <User size={32} />
                                </div>
                                <div className="avatar-info">
                                    <h3>John Doe</h3>
                                    <p>john.doe@email.com</p>
                                </div>
                            </div>
                            <button className="btn btn-secondary">Change Photo</button>
                        </div>

                        <div className="settings-form">
                            <div className="form-group">
                                <label>Full Name</label>
                                <input type="text" className="input" defaultValue="John Doe" />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input type="email" className="input" defaultValue="john.doe@email.com" />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input type="tel" className="input" defaultValue="+1 (555) 123-4567" />
                            </div>
                            <div className="form-actions">
                                <button className="btn btn-primary">Save Changes</button>
                                <button className="btn btn-secondary">Cancel</button>
                            </div>
                        </div>
                    </section>
                )}

                {activeSection === 'notifications' && (
                    <section className="settings-section">
                        <h2 className="section-title">Notification Preferences</h2>
                        <p className="section-description">Choose what notifications you want to receive.</p>

                        <div className="notification-list">
                            <div className="notification-item">
                                <div className="notification-info">
                                    <h4>Price Alerts</h4>
                                    <p>Get notified when your watched stocks hit target prices</p>
                                </div>
                                <button
                                    className={`toggle ${notifications.priceAlerts ? 'active' : ''}`}
                                    onClick={() => handleNotificationChange('priceAlerts')}
                                >
                                    <span className="toggle-handle"></span>
                                </button>
                            </div>
                            <div className="notification-item">
                                <div className="notification-info">
                                    <h4>Daily News Digest</h4>
                                    <p>Receive a summary of important market news each morning</p>
                                </div>
                                <button
                                    className={`toggle ${notifications.newsDigest ? 'active' : ''}`}
                                    onClick={() => handleNotificationChange('newsDigest')}
                                >
                                    <span className="toggle-handle"></span>
                                </button>
                            </div>
                            <div className="notification-item">
                                <div className="notification-info">
                                    <h4>Portfolio Updates</h4>
                                    <p>Get alerts about significant changes in your portfolio</p>
                                </div>
                                <button
                                    className={`toggle ${notifications.portfolioUpdates ? 'active' : ''}`}
                                    onClick={() => handleNotificationChange('portfolioUpdates')}
                                >
                                    <span className="toggle-handle"></span>
                                </button>
                            </div>
                            <div className="notification-item">
                                <div className="notification-info">
                                    <h4>Market Open/Close</h4>
                                    <p>Receive notifications when markets open and close</p>
                                </div>
                                <button
                                    className={`toggle ${notifications.marketOpen ? 'active' : ''}`}
                                    onClick={() => handleNotificationChange('marketOpen')}
                                >
                                    <span className="toggle-handle"></span>
                                </button>
                            </div>
                            <div className="notification-item">
                                <div className="notification-info">
                                    <h4>Weekly Report</h4>
                                    <p>Get a weekly summary of your portfolio performance</p>
                                </div>
                                <button
                                    className={`toggle ${notifications.weeklyReport ? 'active' : ''}`}
                                    onClick={() => handleNotificationChange('weeklyReport')}
                                >
                                    <span className="toggle-handle"></span>
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {activeSection === 'appearance' && (
                    <section className="settings-section">
                        <h2 className="section-title">Appearance</h2>
                        <p className="section-description">Customize how FinVest looks on your device.</p>

                        <div className="appearance-option">
                            <h4>Theme</h4>
                            <div className="theme-options">
                                <button
                                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => { setTheme('dark'); applyTheme('dark'); }}
                                >
                                    <div className="theme-preview dark">
                                        <Moon size={20} />
                                    </div>
                                    <span>Dark</span>
                                    {theme === 'dark' && <Check size={16} className="check-icon" />}
                                </button>
                                <button
                                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                                    onClick={() => { setTheme('light'); applyTheme('light'); }}
                                >
                                    <div className="theme-preview light">
                                        <Sun size={20} />
                                    </div>
                                    <span>Light</span>
                                    {theme === 'light' && <Check size={16} className="check-icon" />}
                                </button>
                                <button
                                    className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                                    onClick={() => { setTheme('system'); applyTheme('system'); }}
                                >
                                    <div className="theme-preview system">
                                        <Palette size={20} />
                                    </div>
                                    <span>System</span>
                                    {theme === 'system' && <Check size={16} className="check-icon" />}
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {activeSection === 'language' && (
                    <section className="settings-section">
                        <h2 className="section-title">Language & Region</h2>
                        <p className="section-description">Set your preferred language and currency.</p>

                        <div className="settings-form">
                            <div className="form-group">
                                <label>Language</label>
                                <div className="select-wrapper">
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="select"
                                    >
                                        {languages.map(lang => (
                                            <option key={lang} value={lang}>{lang}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Display Currency</label>
                                <div className="currency-options">
                                    {currencies.map(curr => (
                                        <button
                                            key={curr}
                                            className={`currency-option ${currency === curr ? 'active' : ''}`}
                                            onClick={() => setCurrency(curr)}
                                        >
                                            {curr}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {activeSection === 'security' && (
                    <section className="settings-section">
                        <h2 className="section-title">Security</h2>
                        <p className="section-description">Keep your account secure.</p>

                        <div className="security-options">
                            <div className="security-item">
                                <div className="security-info">
                                    <h4>Password</h4>
                                    <p>Last changed 30 days ago</p>
                                </div>
                                <button className="btn btn-secondary">Change</button>
                            </div>
                            <div className="security-item">
                                <div className="security-info">
                                    <h4>Two-Factor Authentication</h4>
                                    <p>Add an extra layer of security to your account</p>
                                </div>
                                <button className="btn btn-primary">Enable</button>
                            </div>
                            <div className="security-item">
                                <div className="security-info">
                                    <h4>Active Sessions</h4>
                                    <p>Manage devices where you're logged in</p>
                                </div>
                                <button className="btn btn-secondary">View All</button>
                            </div>
                        </div>
                    </section>
                )}

                {(activeSection === 'billing' || activeSection === 'help') && (
                    <section className="settings-section">
                        <h2 className="section-title">
                            {activeSection === 'billing' ? 'Billing' : 'Help & Support'}
                        </h2>
                        <p className="section-description">
                            {activeSection === 'billing'
                                ? 'Manage your subscription and payment methods.'
                                : 'Get help with using FinVest.'}
                        </p>
                        <div className="coming-soon">
                            <Palette size={48} />
                            <h3>Coming Soon</h3>
                            <p>This feature is currently under development.</p>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
