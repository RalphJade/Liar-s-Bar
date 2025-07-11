import { renderLoginForm } from './components/LoginForm.ts';
import { renderRegisterForm } from './components/RegisterForm.ts';

/**
 * Renders the main landing page.
 * It introduces the game and provides login/registration options.
 * @param element The root HTML element to render the page content into.
 */
export const renderAuthPage = (element: HTMLElement) => {
  element.innerHTML = `
    <main class="page-container landing-page-container">
      
      <!-- 1. Hero Section: Welcome to the Bar -->
      <section class="landing-hero">
        <div class="hero-content hero-content-centered">
          <h1 class="homepage-title">Liar's Bar</h1>
          <p class="landing-tagline">
            Where deception is survival and one wrong move could be your last.
          </p>
          <div class="hero-badges">
            <span class="badge danger">💀 HIGH STAKES</span>
            <span class="badge warning">🎲 DEADLY GAMES</span>
            <span class="badge accent">🃏 PURE DECEPTION</span>
          </div>
        </div>
        
      </section>

      <!-- 2. Game Preview Cards -->
      <section class="game-preview">
        <div class="preview-cards">
          <div class="preview-card">
            <div class="card-icon">🎯</div>
            <h3>Russian Roulette</h3>
            <p>One wrong move and you're out. Forever.</p>
          </div>
          <div class="preview-card">
            <div class="card-icon">🃏</div>
            <h3>Liar's Deck</h3>
            <p>Bluff, deceive, and outwit your opponents.</p>
          </div>
          <div class="preview-card">
            <div class="card-icon">👥</div>
            <h3>4 Players</h3>
            <p>Only one survives. Will it be you?</p>
          </div>
        </div>
      </section>

      <!-- 3. Game Rules Section -->
      <section id="game-rules-section" class="rules-section">
        <div class="section-header">
          <h2 class="section-title">⚖️ The Rules of the House</h2>
          <p class="section-subtitle">Learn the game before you lose your life</p>
        </div>
        
        <div class="rules-grid">
          <div class="rule-card">
            <div class="rule-number">1</div>
            <div class="rule-content">
              <h3>The Setup</h3>
              <p>4 players start with 5 cards each. The deck contains <strong>6 Aces, 6 Kings, 6 Queens</strong>, and two deadly <strong>Jokers</strong>.</p>
            </div>
          </div>
          
          <div class="rule-card">
            <div class="rule-number">2</div>
            <div class="rule-content">
              <h3>The Bluff</h3>
              <p>Play cards face-down and claim they match the required type. <strong>Lying is encouraged</strong> - it's your best weapon.</p>
            </div>
          </div>
          
          <div class="rule-card">
            <div class="rule-number">3</div>
            <div class="rule-content">
              <h3>The Challenge</h3>
              <p>Call out bluffs or play your own cards. Wrong accusations have <strong>deadly consequences</strong>.</p>
            </div>
          </div>
          
          <div class="rule-card danger-card">
            <div class="rule-number">💀</div>
            <div class="rule-content">
              <h3>The Reckoning</h3>
              <p>Losers face the Roulette. Your <strong>Risk Level</strong> increases with each mistake. <strong>💀 Bang</strong> means elimination.</p>
            </div>
          </div>
        </div>
        
        <div class="survival-stats">
          <div class="stat">
            <div class="stat-number">25%</div>
            <div class="stat-label">Survival Rate</div>
          </div>
          <div class="stat">
            <div class="stat-number">6</div>
            <div class="stat-label">Chambers</div>
          </div>
          <div class="stat">
            <div class="stat-number">∞</div>
            <div class="stat-label">Regrets</div>
          </div>
        </div>
      </section>

      <!-- 4. Authentication Section -->
      <section id="auth-section" class="auth-section">
        <div class="auth-header">
          <h2 class="section-title">🚪 Ready to Enter?</h2>
          <p class="auth-subtitle">Join the most dangerous game in town</p>
        </div>
        
        <div class="auth-container">
          <div class="tab-container">
            <button id="login-tab-btn" class="tab-button active" data-tab="login">
              <span class="tab-icon">🔓</span>
              Login
            </button>
            <button id="register-tab-btn" class="tab-button" data-tab="register">
              <span class="tab-icon">📝</span>
              Register
            </button>
          </div>
          
          <div id="auth-form-container" class="auth-form-container">
            <!-- The active form component will be rendered here -->
          </div>
          
          <div class="auth-footer">
            <div class="warning-text">
              <span class="warning-icon">⚠️</span>
              <small>By entering, you accept the risks. No guarantees of survival.</small>
            </div>
          </div>
        </div>
      </section>
      
      <!-- 5. Call to Action -->
      <section class="cta-section">
        <div class="cta-content">
          <h2>The Bar is Open</h2>
          <p>Players worldwide are already inside. Some have already lost everything.</p>
          <div class="urgency-indicators">
            <div class="indicator">
              <span class="indicator-dot pulsing"></span>
              <span>Live games in progress</span>
            </div>
            <div class="indicator">
              <span class="indicator-dot danger"></span>
              <span>High elimination rate</span>
            </div>
          </div>
        </div>
      </section>

    </main>
  `;
  
  const loginTabBtn = document.getElementById('login-tab-btn')!;
  const registerTabBtn = document.getElementById('register-tab-btn')!;
  const formContainer = document.getElementById('auth-form-container')!;

  const switchTab = (tab: 'login' | 'register') => {
    if (tab === 'login') {
      loginTabBtn.classList.add('active');
      registerTabBtn.classList.remove('active');
      renderLoginForm(formContainer);
    } else {
      registerTabBtn.classList.add('active');
      loginTabBtn.classList.remove('active');
      renderRegisterForm(formContainer);
    }
  };

  loginTabBtn.addEventListener('click', () => switchTab('login'));
  registerTabBtn.addEventListener('click', () => switchTab('register'));

  // Add scroll animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, observerOptions);

  // Observe elements for animation
  document.querySelectorAll('.preview-card, .rule-card, .auth-container').forEach(el => {
    observer.observe(el);
  });

  // Render the login form by default when the page first loads.
  renderLoginForm(formContainer);
};