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
import { useState } from 'react';

const PASSCODE_LENGTH = 6;

export default function PasscodeGate() {
  const {
    setAuth,
    setModelType,
    setLocalProxyValue,
    setInitState,
    setIsFirstLaunch,
  } = useAuthStore();

  const [tab, setTab] = useState<'login' | 'register'>('login');
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
        setRegisterError('Registration failed. Please try again.');
      }
    } catch {
      setRegisterError('Registration failed. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  const handleDoneRegister = () => {
    // Auto-login with the generated passcode
    void handleLogin(generatedPasscode);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="bg-white/10 mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl backdrop-blur-sm">
            <span className="text-white text-3xl font-bold">M</span>
          </div>
          <h1 className="text-white text-2xl font-bold">M3RCI Classroom</h1>
          <p className="text-white/60 mt-1 text-sm">
            Enter your passcode to begin
          </p>
        </div>

        {/* Card */}
        <div className="border-white/10 bg-white/5 rounded-2xl border p-6 backdrop-blur-sm">
          {/* Tabs */}
          <div className="bg-white/5 mb-6 flex rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setLoginError('');
              }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'login'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/50 hover:text-white/80'
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
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              Get a Passcode
            </button>
          </div>

          {/* Login Tab */}
          {tab === 'login' && (
            <div>
              <div className="mb-6">
                <label className="text-white/80 mb-2 block text-sm font-medium">
                  Enter your 6-digit passcode
                </label>
                <div className="flex justify-center gap-2">
                  {Array.from({ length: PASSCODE_LENGTH }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex h-14 w-11 items-center justify-center rounded-lg border text-xl font-bold transition-all ${
                        passcode[i]
                          ? 'bg-purple-500/20 text-white border-purple-400'
                          : passcode.length === i && !loggingIn
                            ? 'border-white/30 bg-white/10 text-white'
                            : 'border-white/10 bg-white/5 text-white/30'
                      }`}
                    >
                      {passcode[i] ||
                        (passcode.length === i && !loggingIn ? '|' : '')}
                    </div>
                  ))}
                </div>
                {/* Hidden input to capture keyboard input */}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  value={passcode}
                  onChange={(e) => handlePasscodeInput(e.target.value)}
                  className="mt-2 w-full bg-transparent text-center text-lg tracking-[0.5em] text-transparent caret-transparent outline-none"
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    width: 1,
                    height: 1,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace') {
                      handlePasscodeInput(passcode.slice(0, -1));
                    }
                  }}
                />
              </div>
              {loginError && (
                <p className="mb-4 text-center text-sm text-red-400">
                  {loginError}
                </p>
              )}
              {loggingIn && (
                <p className="text-white/50 text-center text-sm">
                  Signing in...
                </p>
              )}
              <p className="text-white/30 text-center text-xs">
                Forgot your passcode? Contact your instructor.
              </p>
            </div>
          )}

          {/* Register Tab */}
          {tab === 'register' && (
            <div>
              {registerStep === 'form' && (
                <div>
                  <label className="text-white/80 mb-2 block text-sm font-medium">
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
                    className="border-white/10 bg-white/5 text-white placeholder-white/30 mb-4 w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors focus:border-purple-400"
                  />
                  {registerError && (
                    <p className="mb-4 text-sm text-red-400">{registerError}</p>
                  )}
                  <button
                    type="button"
                    disabled={!name.trim() || registering}
                    onClick={handleRegister}
                    className="text-white w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {registering ? 'Generating...' : 'Generate Passcode'}
                  </button>
                </div>
              )}

              {registerStep === 'done' && (
                <div>
                  {/* Passcode display */}
                  <div className="mb-4 text-center">
                    <p className="text-white/60 mb-2 text-sm">Your passcode</p>
                    <div className="inline-flex gap-2">
                      {generatedPasscode.split('').map((digit, i) => (
                        <div
                          key={i}
                          className="bg-purple-500/20 text-white flex h-14 w-11 items-center justify-center rounded-lg border border-purple-400 text-xl font-bold"
                        >
                          {digit}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Option A: Warning notice with confirmation checkbox */}
                  <div className="border-amber-500/30 bg-amber-500/10 mb-4 rounded-lg border p-4">
                    <div className="mb-1 flex items-start gap-2">
                      <span className="mt-0.5 text-lg">⚠️</span>
                      <div>
                        <p className="text-sm font-semibold text-amber-300">
                          IMPORTANT — Please Read
                        </p>
                        <p className="text-amber-200/80 mt-1 text-xs leading-relaxed">
                          This passcode is the <strong>ONLY</strong> way to
                          access your account. Write it down or save it
                          somewhere safe right now.
                        </p>
                        <p className="text-amber-200/60 mt-1 text-xs leading-relaxed">
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
                        className="border-white/20 bg-white/5 h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                      <label
                        htmlFor="confirm-saved"
                        className="text-white/70 text-xs"
                      >
                        I have saved my passcode
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!confirmed}
                    onClick={handleDoneRegister}
                    className="text-white w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Got it, I&apos;ve saved it!
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
