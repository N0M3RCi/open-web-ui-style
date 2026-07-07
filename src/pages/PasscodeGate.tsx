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
import { useEffect, useRef, useState } from 'react';

const PASSCODE_LENGTH = 6;

// ─── Particle Constellation Canvas ───────────────────────────────────────────

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const PARTICLE_COUNT = 120;
    const CONNECTION_DIST = 140;
    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
    }[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 2.5 + 1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Update and draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
      }

      // Draw connections (constellation lines)
      ctx.lineWidth = 0.8;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.5;
            // Yellow-to-black gradient based on position
            const mix = Math.random() > 0.5 ? 0 : 1;
            ctx.strokeStyle = mix
              ? `rgba(255, 215, 0, ${alpha})`
              : `rgba(0, 0, 0, ${alpha * 0.6})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
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
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" />
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PasscodeGate() {
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
      // Small delay to let DOM settle after tab switch
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
      <ParticleCanvas />
      <div className="bg-white relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="border-black bg-white mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border-2 shadow-lg">
              <span className="text-black text-3xl font-bold">M</span>
            </div>
            <h1 className="text-black text-2xl font-bold">M3RCI Classroom</h1>
            <p className="text-black/60 mt-1 text-sm">
              Enter your passcode to begin
            </p>
          </div>

          {/* Card */}
          <div className="border-black/10 bg-white rounded-2xl border-2 p-6 shadow-xl">
            {/* Tabs */}
            <div className="border-black/10 bg-black/5 mb-6 flex rounded-lg border p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setLoginError('');
                }}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  tab === 'login'
                    ? 'bg-black text-white shadow-sm'
                    : 'text-black/50 hover:text-black/80'
                }`}
              >
                Enter Passcode
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setRegisterError('');
                  setRegisterStep('form');
                }}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  tab === 'register'
                    ? 'bg-black text-white shadow-sm'
                    : 'text-black/50 hover:text-black/80'
                }`}
              >
                Get a Passcode
              </button>
            </div>

            {/* Login Tab */}
            {tab === 'login' && (
              <div>
                <div className="mb-6">
                  <label className="text-black/80 mb-2 block text-sm font-medium">
                    Enter your 6-digit passcode
                  </label>
                  <div className="flex justify-center gap-2">
                    {Array.from({ length: PASSCODE_LENGTH }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex h-14 w-11 items-center justify-center rounded-lg border text-xl font-bold transition-all ${
                          passcode[i]
                            ? 'text-black border-yellow-500 bg-yellow-100'
                            : passcode.length === i && !loggingIn
                              ? 'border-black/30 bg-black/5 text-black'
                              : 'border-black/10 bg-black/5 text-black/30'
                        }`}
                      >
                        {passcode[i] ||
                          (passcode.length === i && !loggingIn ? '|' : '')}
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
                  {/* Click-to-focus overlay */}
                  <div
                    className="mt-2 flex cursor-text justify-center"
                    onClick={() => passcodeInputRef.current?.focus()}
                  >
                    <span className="text-black/40 text-xs">
                      Click here and type your passcode
                    </span>
                  </div>
                </div>
                {loginError && (
                  <p className="mb-4 text-center text-sm text-red-500">
                    {loginError}
                  </p>
                )}
                {loggingIn && (
                  <p className="text-black/50 text-center text-sm">
                    Signing in...
                  </p>
                )}
                <p className="text-black/30 text-center text-xs">
                  Forgot your passcode? Contact your instructor.
                </p>
              </div>
            )}

            {/* Register Tab */}
            {tab === 'register' && (
              <div>
                {registerStep === 'form' && (
                  <div>
                    <label className="text-black/80 mb-2 block text-sm font-medium">
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
                      placeholder="e.g. Alice"
                      className="border-black/10 bg-white text-black placeholder-black/30 mb-4 w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    />
                    {registerError && (
                      <p className="mb-4 text-sm text-red-500">
                        {registerError}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={!name.trim() || registering}
                      onClick={handleRegister}
                      className="bg-black text-white hover:bg-black/80 w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {registering ? 'Generating...' : 'Generate Passcode'}
                    </button>
                  </div>
                )}

                {registerStep === 'done' && (
                  <div>
                    {/* Passcode display */}
                    <div className="mb-4 text-center">
                      <p className="text-black/60 mb-2 text-sm">
                        Your passcode
                      </p>
                      <div className="inline-flex gap-2">
                        {generatedPasscode.split('').map((digit, i) => (
                          <div
                            key={i}
                            className="text-black flex h-14 w-11 items-center justify-center rounded-lg border border-yellow-500 bg-yellow-100 text-xl font-bold"
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Warning notice */}
                    <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 p-4">
                      <div className="mb-1 flex items-start gap-2">
                        <span className="mt-0.5 text-lg">⚠️</span>
                        <div>
                          <p className="text-sm font-semibold text-amber-700">
                            IMPORTANT — Please Read
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-amber-600">
                            This passcode is the <strong>ONLY</strong> way to
                            access your account. Write it down or save it
                            somewhere safe right now.
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-amber-500">
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
                          className="border-black/20 h-4 w-4 rounded text-yellow-500 focus:ring-yellow-500"
                        />
                        <label
                          htmlFor="confirm-saved"
                          className="text-black/70 text-xs"
                        >
                          I have saved my passcode
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!confirmed}
                      onClick={handleDoneRegister}
                      className="bg-black text-white hover:bg-black/80 w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
                  <label className="text-black/80 mb-2 block text-sm font-medium">
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
                    className="border-black/10 bg-white text-black placeholder-black/30 mb-3 w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                  />
                  <label className="text-black/80 mb-2 block text-sm font-medium">
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
                    className="border-black/10 bg-white text-black placeholder-black/30 mb-4 w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                  />
                  {adminLoginError && (
                    <p className="mb-4 text-sm text-red-500">
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
                    className="bg-black text-white hover:bg-black/80 w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
                className="text-black/50 decoration-black/20 hover:text-black/80 hover:decoration-black/40 text-sm font-medium underline underline-offset-2 transition-colors"
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
                className="text-black/50 decoration-black/20 hover:text-black/80 hover:decoration-black/40 text-sm font-medium underline underline-offset-2 transition-colors"
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
