// ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========

import { proxyFetchPost } from '@/api/http';
import { useAuthStore } from '@/store/authStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PASSCODE_LENGTH = 6;

// ─── Live Constellation Canvas ────────────────────────────────────────────────

function ConstellationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const PARTICLE_COUNT = 100;
    const CONNECTION_DIST = 180;
    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      baseSize: number;
      phase: number;
    }[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const baseSize = Math.random() * 2 + 0.8;
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: baseSize,
        baseSize,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Mouse tracking
    const handleMouse = (e: MouseEvent | TouchEvent) => {
      let cx: number;
      let cy: number;
      if ('touches' in e) {
        if (e.touches.length === 0) return;
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
      } else {
        cx = e.clientX;
        cy = e.clientY;
      }
      mouseRef.current = { x: cx, y: cy };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };
    window.addEventListener('mousemove', handleMouse);
    window.addEventListener('touchmove', handleMouse, { passive: true });
    window.addEventListener('touchend', handleMouseLeave);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const now = Date.now() / 1000;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // ── Update and draw particles ──────────────────────────────────────
      for (const p of particles) {
        // Gentle mouse repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const mDist = Math.sqrt(dx * dx + dy * dy);
        if (mDist < 120 && mDist > 0) {
          const force = (120 - mDist) / 120;
          p.vx += (dx / mDist) * force * 0.3;
          p.vy += (dy / mDist) * force * 0.3;
        }

        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        // Pulsing size
        const pulse = Math.sin(now * 0.8 + p.phase) * 0.3 + 0.7;
        p.size = p.baseSize * pulse;

        // Glow layer
        const glow = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.size * 4
        );
        glow.addColorStop(0, 'rgba(200, 170, 50, 0.3)');
        glow.addColorStop(0.5, 'rgba(200, 170, 50, 0.08)');
        glow.addColorStop(1, 'rgba(200, 170, 50, 0)');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Core particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180, 155, 50, 0.5)';
        ctx.fill();

        // Yellow highlight on larger particles
        if (p.baseSize > 1.8) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(220, 190, 60, 0.6)';
          ctx.fill();
        }
      }

      // ── Constellation connections ──────────────────────────────────────
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DIST) {
            const ratio = dist / CONNECTION_DIST;
            const alpha = (1 - ratio) * 0.2;
            // Yellow lines
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(180, 155, 50, ${alpha * 0.4})`;
            ctx.lineWidth = (1 - ratio) * 0.8 + 0.2;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('touchmove', handleMouse);
      window.removeEventListener('touchend', handleMouseLeave);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PasscodeGate() {
  const navigate = useNavigate();
  const {
    setAuth,
    setModelType,
    setLocalProxyValue,
    setInitState,
    setIsFirstLaunch,
  } = useAuthStore();

  const [tab, setTab] = useState<'login' | 'register' | 'admin'>('login');
  // Login state
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  // Register state
  const [name, setName] = useState('');
  const [registerStep, setRegisterStep] = useState<'form' | 'done'>('form');
  const [generatedPasscode, setGeneratedPasscode] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  // Admin login state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoggingIn, setAdminLoggingIn] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');

  // Refs for focus management
  const passcodeInputRef = useRef<HTMLInputElement>(null);
  const adminEmailRef = useRef<HTMLInputElement>(null);

  // Keep hidden input focused when on login tab
  useEffect(() => {
    if (tab === 'login') {
      const t = setTimeout(() => passcodeInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [tab]);

  // Focus admin email field when switching to admin tab
  useEffect(() => {
    if (tab === 'admin') {
      const t = setTimeout(() => adminEmailRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [tab]);

  // Click anywhere on login tab to refocus the hidden input
  const handleLoginAreaClick = useCallback(() => {
    if (tab === 'login') {
      passcodeInputRef.current?.focus();
    }
  }, [tab]);

  const handleLogin = async (code: string) => {
    if (code.length !== PASSCODE_LENGTH) return;
    setLoggingIn(true);
    setLoginError('');
    try {
      const data = await proxyFetchPost('/api/v1/auth/passcode-login', {
        passcode: code,
      });
      if (data && data.token) {
        setAuth({ email: data.email, ...data });
        setLocalProxyValue(import.meta.env.VITE_USE_LOCAL_PROXY || null);
        setModelType('custom');
        setInitState('done');
        setIsFirstLaunch(false);
        navigate('/');
      } else {
        setLoginError('Invalid passcode. Please try again.');
      }
    } catch {
      setLoginError('Invalid passcode. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handlePasscodeInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, PASSCODE_LENGTH);
    setPasscode(digits);
    setLoginError('');
    if (digits.length === PASSCODE_LENGTH) {
      void handleLogin(digits);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) return;
    setRegistering(true);
    setRegisterError('');
    try {
      const data = await proxyFetchPost('/api/v1/auth/passcode-register', {
        name: name.trim(),
      });
      if (data && data.passcode) {
        setGeneratedPasscode(data.passcode);
        setRegisterStep('done');
      } else {
        setRegisterError(
          data?.text || 'Registration failed. Please try again.'
        );
      }
    } catch (err: any) {
      setRegisterError(
        err?.message || 'Registration failed. Please try again.'
      );
    } finally {
      setRegistering(false);
    }
  };

  const handleDoneRegister = () => {
    void handleLogin(generatedPasscode);
  };

  const handleAdminLogin = async () => {
    if (!adminEmail.trim() || !adminPassword.trim()) {
      setAdminLoginError('Please enter email and password.');
      return;
    }
    setAdminLoggingIn(true);
    setAdminLoginError('');
    try {
      const data = await proxyFetchPost('/api/v1/user/login', {
        email: adminEmail.trim(),
        password: adminPassword,
      });
      if (data && data.access_token) {
        setAuth({
          email: adminEmail.trim(),
          token: data.access_token,
          ...data,
        });
        setLocalProxyValue(import.meta.env.VITE_USE_LOCAL_PROXY || null);
        setModelType('custom');
        setInitState('done');
        setIsFirstLaunch(false);
        navigate('/');
      } else {
        setAdminLoginError('Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setAdminLoginError(
        err?.message || 'Login failed. Please check your credentials.'
      );
    } finally {
      setAdminLoggingIn(false);
    }
  };

  return (
    <>
      <div
        className="bg-white relative z-10 flex min-h-screen items-center justify-center p-4"
        onClick={handleLoginAreaClick}
      >
        <ConstellationCanvas />
        <div className="relative z-10 w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="bg-black shadow-yellow-500/20 mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-yellow-500 shadow-lg">
              <span className="text-3xl">🤖</span>
            </div>
            <h1 className="text-black text-2xl font-bold">M3RCI-UniMind</h1>
            <p className="text-black/60 mt-1 text-sm">
              Enter your passcode to begin
            </p>
          </div>

          {/* Card */}
          <div className="bg-black shadow-yellow-500/20 rounded-2xl border-2 border-yellow-500 p-6 shadow-xl">
            {/* Tabs */}
            <div className="border-yellow-500/20 bg-yellow-500/10 mb-6 flex rounded-lg border p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setLoginError('');
                }}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  tab === 'login'
                    ? 'text-black bg-yellow-500 shadow-sm'
                    : 'text-yellow-400/70 hover:text-yellow-300'
                }`}
              >
                Your 6 digit Passcode
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setRegisterError('');
                  setRegisterStep('form');
                }}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  tab === 'register'
                    ? 'text-black bg-yellow-500 shadow-sm'
                    : 'text-yellow-400/70 hover:text-yellow-300'
                }`}
              >
                Get a Passcode
              </button>
            </div>

            {/* Login Tab */}
            {tab === 'login' && (
              <div>
                <div className="mb-6">
                  <label className="text-yellow-400/80 mb-2 block text-sm font-medium"></label>
                  <div className="flex justify-center gap-2.5">
                    {Array.from({ length: PASSCODE_LENGTH }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex h-14 w-11 items-center justify-center rounded-xl border-2 text-xl font-bold transition-all duration-150 ${
                          passcode[i]
                            ? 'bg-black text-white shadow-yellow-500/30 border-yellow-400 shadow-lg'
                            : passcode.length === i && !loggingIn
                              ? 'bg-black text-white shadow-yellow-500/20 border-yellow-500 shadow-md'
                              : 'border-yellow-500/30 bg-black text-yellow-500/20'
                        }`}
                      >
                        {passcode[i] ||
                          (passcode.length === i && !loggingIn ? (
                            <span className="text-white animate-pulse">|</span>
                          ) : (
                            ''
                          ))}
                      </div>
                    ))}
                  </div>
                  {/* Hidden input to capture keyboard input */}
                  <input
                    ref={passcodeInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoFocus
                    value={passcode}
                    onChange={(e) => handlePasscodeInput(e.target.value)}
                    className="sr-only"
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: 1,
                      height: 1,
                      pointerEvents: 'none',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace') {
                        handlePasscodeInput(passcode.slice(0, -1));
                      }
                    }}
                  />
                  <div className="mt-2 flex cursor-text justify-center">
                    <span className="text-yellow-400/40 text-xs">
                      Click anywhere and type your passcode
                    </span>
                  </div>
                </div>
                {loginError && (
                  <p className="mb-4 text-center text-sm font-medium text-red-400">
                    {loginError}
                  </p>
                )}
                {loggingIn && (
                  <p className="text-yellow-400/60 text-center text-sm">
                    Signing in...
                  </p>
                )}
                <p className="text-yellow-400/40 text-center text-xs">
                  Forgot your passcode? Contact your instructor.
                </p>
              </div>
            )}

            {/* Register Tab */}
            {tab === 'register' && (
              <div>
                {registerStep === 'form' && (
                  <div>
                    <label className="text-yellow-400/80 mb-2 block text-sm font-medium">
                      Enter your name to get a passcode
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && name.trim() && !registering) {
                          void handleRegister();
                        }
                      }}
                      placeholder="e.g. Prince"
                      className="border-yellow-500/20 bg-black placeholder:text-yellow-400/30 focus:ring-yellow-500/30 mb-4 w-full rounded-lg border px-4 py-3 text-sm text-yellow-400 outline-none transition-colors focus:border-yellow-500 focus:ring-2"
                    />
                    {registerError && (
                      <p className="mb-4 text-sm text-red-400">
                        {registerError}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={!name.trim() || registering}
                      onClick={handleRegister}
                      className="text-black w-full rounded-lg bg-yellow-500 px-4 py-3 text-sm font-medium transition-all hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {registering ? 'Generating...' : 'Generate Passcode'}
                    </button>
                  </div>
                )}

                {registerStep === 'done' && (
                  <div>
                    {/* Passcode display */}
                    <div className="mb-4 text-center">
                      <p className="text-yellow-400/60 mb-2 text-sm">
                        Your passcode
                      </p>
                      <div className="inline-flex gap-2.5">
                        {generatedPasscode.split('').map((digit, i) => (
                          <div
                            key={i}
                            className="bg-black shadow-yellow-500/30 flex h-14 w-11 items-center justify-center rounded-xl border-2 border-yellow-400 text-xl font-bold text-yellow-400 shadow-lg"
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Warning notice */}
                    <div className="border-yellow-500/30 from-yellow-900/40 to-amber-950/40 mb-4 rounded-xl border bg-gradient-to-br p-4">
                      <div className="mb-1 flex items-start gap-2">
                        <span className="mt-0.5 text-lg">⚠️</span>
                        <div>
                          <p className="text-sm font-bold text-yellow-400">
                            IMPORTANT — Please Read
                          </p>
                          <p className="text-yellow-400/70 mt-1 text-xs leading-relaxed">
                            This passcode is the <strong>ONLY</strong> way to
                            access your account. Write it down or save it
                            somewhere safe right now.
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-yellow-500">
                            Without this passcode, you will lose access to your
                            chats and data.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="confirm-saved"
                          checked={confirmed}
                          onChange={(e) => setConfirmed(e.target.checked)}
                          className="border-yellow-500/30 h-4 w-4 rounded text-yellow-500 focus:ring-yellow-500"
                        />
                        <label
                          htmlFor="confirm-saved"
                          className="text-yellow-400/70 text-xs"
                        >
                          I have saved my passcode
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!confirmed}
                      onClick={handleDoneRegister}
                      className="text-black w-full rounded-lg bg-yellow-500 px-4 py-3 text-sm font-medium transition-all hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Got it, I&apos;ve saved it!
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Admin Login Tab */}
            {tab === 'admin' && (
              <div>
                <div className="mb-6">
                  <label className="text-yellow-400/80 mb-2 block text-sm font-medium">
                    Admin Email
                  </label>
                  <input
                    ref={adminEmailRef}
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !adminLoggingIn) {
                        void handleAdminLogin();
                      }
                    }}
                    placeholder="admin@example.com"
                    className="border-yellow-500/20 bg-black placeholder:text-yellow-400/30 focus:ring-yellow-500/30 mb-3 w-full rounded-lg border px-4 py-3 text-sm text-yellow-400 outline-none transition-colors focus:border-yellow-500 focus:ring-2"
                  />
                  <label className="text-yellow-400/80 mb-2 block text-sm font-medium">
                    Password
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !adminLoggingIn) {
                        void handleAdminLogin();
                      }
                    }}
                    placeholder="Enter your password"
                    className="border-yellow-500/20 bg-black placeholder:text-yellow-400/30 focus:ring-yellow-500/30 mb-4 w-full rounded-lg border px-4 py-3 text-sm text-yellow-400 outline-none transition-colors focus:border-yellow-500 focus:ring-2"
                  />
                  {adminLoginError && (
                    <p className="mb-4 text-sm font-medium text-red-400">
                      {adminLoginError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={
                      !adminEmail.trim() ||
                      !adminPassword.trim() ||
                      adminLoggingIn
                    }
                    onClick={handleAdminLogin}
                    className="text-black w-full rounded-lg bg-yellow-500 px-4 py-3 text-sm font-medium transition-all hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {adminLoggingIn ? 'Signing in...' : 'Sign In'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Admin Login Link */}
          <div className="mt-6 text-center">
            {tab !== 'admin' ? (
              <button
                type="button"
                onClick={() => {
                  setTab('admin');
                  setAdminLoginError('');
                }}
                className="hover:bg-yellow-500/10 rounded-lg px-4 py-2 text-sm font-semibold text-yellow-500 transition-all hover:text-yellow-400"
              >
                Admin Login
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setLoginError('');
                }}
                className="text-yellow-400/60 hover:bg-yellow-500/10 rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:text-yellow-400"
              >
                Back to Passcode Login
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
