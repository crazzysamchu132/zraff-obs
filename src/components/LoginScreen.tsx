import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Trophy, Mail, Lock, User, Phone, CheckCircle, ArrowRight, Shield, Copy, ExternalLink, Globe, Check } from 'lucide-react';

interface LoginScreenProps {
  onAuthSuccess: (userId: string) => void;
}

export default function LoginScreen({ onAuthSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'operator' | 'viewer'>('admin');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      // Save profile if missing
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        const username = user.email?.split('@')[0] || 'user_' + user.uid.substring(0, 5);
        await setDoc(userDocRef, {
          uid: user.uid,
          fullName: user.displayName || 'Google User',
          username: username,
          email: user.email || '',
          phone: user.phoneNumber || '',
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
          role: 'admin', // Default role is admin so they have full broadcast operator capabilities immediately
          status: 'active',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          emailVerified: user.emailVerified
        });
      } else {
        // Update last login
        await setDoc(userDocRef, {
          lastLogin: new Date().toISOString()
        }, { merge: true });
      }
      onAuthSuccess(user.uid);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Verify if they have a profile in Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        // Fallback profile if somehow missing
        await setDoc(userDocRef, {
          uid: userCredential.user.uid,
          fullName: userCredential.user.displayName || email.split('@')[0],
          username: email.split('@')[0],
          email: email,
          phone: '',
          photoURL: '',
          role: 'admin', // default to admin
          status: 'active',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          emailVerified: userCredential.user.emailVerified
        });
      }
      onAuthSuccess(userCredential.user.uid);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password login is currently disabled in Firebase Console. Please Sign In with Google below (which is fully configured and enabled)!');
      } else {
        setError(err.message || 'Failed to sign in. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Save user profile to Firestore
      const userProfile = {
        uid,
        fullName,
        username,
        email,
        phone,
        photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
        role,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        emailVerified: userCredential.user.emailVerified
      };

      await setDoc(doc(db, 'users', uid), userProfile);
      
      setSuccessMsg('Account created successfully! Auto-logging in...');
      setTimeout(() => {
        onAuthSuccess(uid);
      }, 1500);

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password registration is currently disabled in Firebase Console. Please Sign In with Google below (which is fully configured and enabled)!');
      } else {
        setError(err.message || 'Failed to register account.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg('Password reset link sent to your email.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#020817] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(197,168,92,0.15),rgba(255,255,255,0))]" id="auth-page">
      <div className="w-full max-w-lg glass-panel-gold rounded-2xl p-8 sm:p-10 shadow-2xl relative overflow-hidden" id="auth-card">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-8" id="auth-header">
          <div className="inline-flex p-3 bg-gradient-to-tr from-yellow-500/15 to-amber-500/15 border border-yellow-500/30 rounded-full mb-4">
            <Trophy className="w-10 h-10 text-yellow-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-white">
            Z-RAFF CHAMPIONS HUB
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Professional Football Broadcast & Tournament Suite
          </p>
        </div>

        {error && (error.toLowerCase().includes('unauthorized-domain') || error.toLowerCase().includes('unauthorized_domain')) ? (
          <div className="p-5 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm space-y-4" id="auth-unauthorized-domain-alert">
            <div className="flex items-start space-x-2.5">
              <span className="text-xl shrink-0">🔒</span>
              <div>
                <h4 className="font-bold text-amber-400 text-base font-display">Firebase Domain Authorization Restriction</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  You are currently accessing this app on <code className="font-mono text-yellow-400 bg-black/40 px-1.5 py-0.5 rounded">{window.location.hostname}</code>. 
                  Because the Firebase database for this app was provisioned under the <strong className="text-white">AI Studio Starter Tier</strong>, permissions are restricted and settings are locked (which is why the <em>"Add domain"</em> option is missing for editors).
                </p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-3 space-y-3">
              <span className="text-xs font-semibold text-slate-200 block uppercase tracking-wider font-mono">Two ways to solve this:</span>
              
              {/* Solution 1 */}
              <div className="bg-slate-950/60 p-3.5 rounded-lg border border-white/5 space-y-2">
                <span className="text-xs font-bold text-yellow-500 block">Solution 1: Use the pre-configured official URLs</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Google Auth is fully configured and authorized for these official runtime preview links. Simply open the application using one of these links instead:
                </p>
                <div className="space-y-1.5 pt-1">
                  <a 
                    href="https://ais-pre-tiiri2gcte7eqmftdq3edv-896918452456.asia-southeast1.run.app" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center justify-between p-2 bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/15 rounded-lg text-yellow-400 text-xs transition"
                  >
                    <span className="truncate font-mono">ais-pre-tiiri2gcte7eqmftdq3edv-...</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                  <a 
                    href="https://ais-dev-tiiri2gcte7eqmftdq3edv-896918452456.asia-southeast1.run.app" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center justify-between p-2 bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/15 rounded-lg text-yellow-400 text-xs transition"
                  >
                    <span className="truncate font-mono">ais-dev-tiiri2gcte7eqmftdq3edv-...</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              </div>

              {/* Solution 2 */}
              <div className="bg-slate-950/60 p-3.5 rounded-lg border border-white/5 space-y-2">
                <span className="text-xs font-bold text-yellow-500 block">Solution 2: Connect your own Firebase project (For Cloudflare Pages / Custom Domains)</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  If you want to host this application on your own website, Cloudflare Pages, or locally, you can easily connect a free Firebase project:
                </p>
                <ol className="list-decimal text-[11px] text-slate-400 space-y-1.5 pl-4 mt-1 leading-normal">
                  <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:underline inline-flex items-center space-x-0.5"><span>Firebase Console</span><ExternalLink className="w-2.5 h-2.5 inline" /></a> and click <strong className="text-slate-300">Add project</strong>.</li>
                  <li>Go to <strong className="text-slate-300">Build &gt; Authentication</strong>, click Get Started, and enable <strong className="text-slate-300">Google</strong> as a sign-in provider.</li>
                  <li>Under Authentication Settings, you will now see the <strong className="text-slate-300">Add domain</strong> button. Add your hosting domain (<code className="font-mono text-yellow-400 bg-black/40 px-1 py-0.5 rounded">{window.location.hostname}</code>) to the list.</li>
                  <li>Copy your project's Web App configuration keys and add them as environment variables (<code className="font-mono text-slate-300 text-[10px]">VITE_FIREBASE_API_KEY</code>, etc.) in your deployment dashboard!</li>
                </ol>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start space-x-2" id="auth-error-alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        ) : null}

        {successMsg && (
          <div className="p-4 mb-6 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm flex items-start space-x-2" id="auth-success-alert">
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-5" id="form-signin">
            <div className="space-y-1.5">
              <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                  <Mail className="w-5 h-5" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 outline-none transition"
                  placeholder="admin@zraffchamp.com"
                  id="signin-email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Password</label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                  className="text-xs text-yellow-500 hover:text-yellow-400 transition"
                  id="btn-forgot-mode"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 outline-none transition"
                  placeholder="••••••••"
                  id="signin-password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <label className="flex items-center space-x-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-white/15 bg-slate-900 text-yellow-500 focus:ring-yellow-500/20 h-4 w-4"
                />
                <span>Remember Me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              id="btn-signin-submit"
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg hover:from-yellow-400 hover:to-amber-500 active:scale-[0.98] transition duration-300 flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Authenticating...' : 'Access Dashboard'}</span>
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>

            <div className="flex items-center my-4">
              <div className="flex-grow h-px bg-white/10"></div>
              <span className="px-3 text-xs font-mono uppercase text-slate-500">or</span>
              <div className="flex-grow h-px bg-white/10"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-white/10 text-white font-medium py-3 px-4 rounded-xl shadow-md transition duration-300 flex items-center justify-center space-x-3"
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-slate-950 text-xs font-black">G</span>
              <span>Continue with Google</span>
            </button>

            <p className="text-center text-sm text-slate-400 mt-6">
              New operator?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
                className="text-yellow-400 font-semibold hover:underline"
                id="btn-signup-mode"
              >
                Register Account
              </button>
            </p>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4" id="form-signup">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-yellow-500/50 outline-none transition"
                    placeholder="John Doe"
                    id="signup-fullname"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Username</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-yellow-500/50 outline-none transition"
                    placeholder="johndoe123"
                    id="signup-username"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                  <Mail className="w-4.5 h-4.5" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-yellow-500/50 outline-none transition"
                  placeholder="name@organization.com"
                  id="signup-email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Phone Number</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                  <Phone className="w-4.5 h-4.5" />
                </span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-yellow-500/50 outline-none transition"
                  placeholder="+1 (555) 000-0000"
                  id="signup-phone"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Request User Role</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                  <Shield className="w-4.5 h-4.5" />
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-yellow-500/50 outline-none transition appearance-none"
                  id="signup-role"
                >
                  <option value="admin" className="bg-slate-950">Administrator (Full Access)</option>
                  <option value="manager" className="bg-slate-950">Tournament Manager</option>
                  <option value="operator" className="bg-slate-950">Broadcast Operator</option>
                  <option value="viewer" className="bg-slate-950">Viewer (Read Only)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                    <Lock className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-yellow-500/50 outline-none transition"
                    placeholder="••••••••"
                    id="signup-password"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Confirm Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                    <Lock className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-yellow-500/50 outline-none transition"
                    placeholder="••••••••"
                    id="signup-confirm-password"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              id="btn-signup-submit"
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg hover:from-yellow-400 hover:to-amber-500 active:scale-[0.98] transition duration-300 mt-2"
            >
              {loading ? 'Creating Credentials...' : 'Register Operator Account'}
            </button>

            <div className="flex items-center my-4">
              <div className="flex-grow h-px bg-white/10"></div>
              <span className="px-3 text-xs font-mono uppercase text-slate-500">or</span>
              <div className="flex-grow h-px bg-white/10"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-white/10 text-white font-medium py-3 px-4 rounded-xl shadow-md transition duration-300 flex items-center justify-center space-x-3"
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-slate-950 text-xs font-black">G</span>
              <span>Sign Up with Google</span>
            </button>

            <p className="text-center text-sm text-slate-400 mt-4">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); }}
                className="text-yellow-400 font-semibold hover:underline"
                id="btn-back-to-signin"
              >
                Sign In
              </button>
            </p>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-5" id="form-forgot">
            <p className="text-sm text-slate-300 mb-4 text-center">
              Enter your email address and we will send you a secure recovery link to reset your credentials.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                  <Mail className="w-5 h-5" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:border-yellow-500/50 outline-none transition"
                  placeholder="name@organization.com"
                  id="forgot-email"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              id="btn-forgot-submit"
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg hover:from-yellow-400 hover:to-amber-500 active:scale-[0.98] transition duration-300 flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Sending Request...' : 'Send Recovery Link'}</span>
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>

            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); }}
                className="text-sm text-yellow-400 font-semibold hover:underline"
                id="btn-forgot-back-to-signin"
              >
                Return to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
