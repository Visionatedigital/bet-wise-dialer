import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { z } from "zod";
import loginBackground from "@/assets/bangbet-login-bg.png";
import bangbetLogo from "@/assets/bangbet-logo.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
  role: z.enum(["agent", "management", "admin"]).optional(),
});

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { signIn, signUp, user, session } = useAuth();
  const navigate = useNavigate();

  const [signInData, setSignInData] = useState({
    email: "",
    password: ""
  });

  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "agent" as "agent" | "management" | "admin"
  });

  // Listen for auth state changes to detect password recovery
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Auth state change:', event, {
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email
        });

        // Detect password recovery event
        if (event === 'PASSWORD_RECOVERY') {
          console.log('[Auth] PASSWORD_RECOVERY event detected - showing reset form');
          setIsResettingPassword(true);
        }

        // If user just signed in via recovery link (SIGNED_IN event with session but no password set yet)
        // Check if this might be a recovery session by checking if user came from a recovery flow
        if (event === 'SIGNED_IN' && session) {
          const hash = window.location.hash;
          const search = window.location.search;

          // Check URL for recovery indicators
          if (hash.includes('type=recovery') || hash.includes('recovery') ||
            search.includes('recovery') || hash.includes('#recovery=true')) {
            console.log('[Auth] SIGNED_IN with recovery token - showing reset form');
            setIsResettingPassword(true);
          } else {
            // Check if session was just created (might be from recovery link click)
            // If session exists but we're on /auth page, it might be recovery
            // Store a flag when password reset email is sent
            const recoveryInitiated = sessionStorage.getItem('passwordRecoveryInitiated');
            if (recoveryInitiated === 'true' && window.location.pathname === '/auth') {
              console.log('[Auth] Session found after recovery email - showing reset form');
              setIsResettingPassword(true);
              sessionStorage.removeItem('passwordRecoveryInitiated');
            }
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Check if we're in password reset mode (URL contains recovery token)
  // This must run FIRST before checking for normal login
  useEffect(() => {
    // Check both URL hash AND query parameters (Supabase might use either)
    const hash = window.location.hash;
    const search = window.location.search;
    const hashParams = new URLSearchParams(hash.substring(1));
    const queryParams = new URLSearchParams(search);

    // Check hash first, then query params
    const type = hashParams.get('type') || queryParams.get('type');
    const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
    const error = hashParams.get('error') || queryParams.get('error');
    const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');

    // Log full URL for debugging
    console.log('[Auth] Full URL:', window.location.href);
    console.log('[Auth] Full URL hash:', hash);
    console.log('[Auth] Full URL search:', search);
    console.log('[Auth] Hash params:', Object.fromEntries(hashParams.entries()));
    console.log('[Auth] Query params:', Object.fromEntries(queryParams.entries()));
    console.log('[Auth] Extracted values:', {
      type,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      error,
      errorDescription,
      hasSession: !!session,
      hasUser: !!user
    });

    // Check for errors in the URL
    if (error) {
      console.error('[Auth] Error in URL hash:', error, errorDescription);
      setError(`Password reset error: ${errorDescription || error}`);
      toast.error(`Password reset failed: ${errorDescription || error}`);
    }

    // PRIORITY: Check if this is a password recovery flow FIRST
    // Check multiple ways the recovery token might appear
    const isRecovery = type === 'recovery' ||
      hash.includes('type=recovery') ||
      hash.includes('recovery') ||
      search.includes('recovery') ||
      hash.includes('#recovery=true') ||
      (accessToken && (hash.includes('recovery') || search.includes('recovery')));

    // Also check if we have a recovery flag in sessionStorage (user clicked reset link)
    const recoveryInitiated = sessionStorage.getItem('passwordRecoveryInitiated');

    if (isRecovery || recoveryInitiated === 'true') {
      console.log('[Auth] Password recovery detected - showing reset form');
      setIsResettingPassword(true);

      // If we have tokens but no session yet, manually exchange them
      if (accessToken && refreshToken && !session) {
        console.log('[Auth] Manually exchanging recovery tokens for session...');
        (async () => {
          try {
            // Set the session manually using the tokens from the URL
            const { data: { session: newSession }, error: exchangeError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (exchangeError) {
              console.error('[Auth] Error exchanging tokens:', exchangeError);
              setError(`Failed to process recovery link: ${exchangeError.message}`);
              toast.error(`Failed to process recovery link: ${exchangeError.message}`);
            } else if (newSession) {
              console.log('[Auth] Recovery session established manually');
              // Session is now set, the form will be shown
            }
          } catch (err) {
            console.error('[Auth] Exception exchanging tokens:', err);
          }
        })();
      } else if (accessToken && !session) {
        console.log('[Auth] Waiting for Supabase to process recovery tokens...');
        // Give Supabase a moment to process the hash and establish session
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('[Auth] Session after waiting:', session ? 'found' : 'not found');
            if (session) {
              console.log('[Auth] Recovery session established');
            } else {
              console.warn('[Auth] No session established - recovery link may be invalid or expired');
              setError("Recovery link is invalid or expired. Please request a new password reset.");
            }
          });
        }, 2000);
      } else if (!accessToken && session && recoveryInitiated === 'true') {
        // We have a session but no tokens in URL - this might be a recovery session
        // Supabase might have already processed the recovery link and established a session
        // Check if this session was created recently (within last 5 minutes)
        const recoveryTimestamp = sessionStorage.getItem('passwordRecoveryTimestamp');
        const isRecent = recoveryTimestamp && (Date.now() - parseInt(recoveryTimestamp)) < 5 * 60 * 1000; // 5 minutes

        if (isRecent) {
          console.log('[Auth] Session exists with recent recovery flag - showing reset form');
          console.log('[Auth] Session user:', session.user.email);
          // Show the reset form - user can update password
          setIsResettingPassword(true);
        } else {
          // Recovery was too long ago, clear the flag
          sessionStorage.removeItem('passwordRecoveryInitiated');
          sessionStorage.removeItem('passwordRecoveryTimestamp');
        }
      } else if (!accessToken && !session && recoveryInitiated === 'true') {
        // No tokens and no session - might be coming from Supabase hosted auth page
        // Check if we have a recovery flag and wait for session
        const recoveryTimestamp = sessionStorage.getItem('passwordRecoveryTimestamp');
        const isRecent = recoveryTimestamp && (Date.now() - parseInt(recoveryTimestamp)) < 5 * 60 * 1000; // 5 minutes

        if (!isRecent) {
          // Recovery was too long ago
          sessionStorage.removeItem('passwordRecoveryInitiated');
          sessionStorage.removeItem('passwordRecoveryTimestamp');
          return;
        }

        console.log('[Auth] Recovery mode but no tokens - waiting for session from Supabase...');
        // Supabase might establish session in the background
        let attempts = 0;
        const maxAttempts = 20; // 10 seconds total
        const checkInterval = setInterval(() => {
          attempts++;
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
              console.log('[Auth] Session found after recovery redirect');
              clearInterval(checkInterval);
              setIsResettingPassword(true);
            } else if (attempts >= maxAttempts) {
              console.warn('[Auth] No session found after waiting - recovery link may have expired or redirect URL not configured');
              clearInterval(checkInterval);
              // Don't set error here - let the form show with a warning instead
              // The form will show a helpful message about redirect URL configuration
              console.log('[Auth] Showing password reset form anyway - user can try to update if session exists');
            }
          });
        }, 500);
      }

      // Don't redirect even if user exists - we need to update password first
      return;
    }

    // Only redirect to dashboard if NOT in recovery mode
    // Also check if we're in the middle of signing out (user might be cleared but state not updated yet)
    // Add a small delay to prevent race condition with signOut
    if (user && !isResettingPassword && session) {
      // Check if we just signed out by looking at the URL or a flag
      const isSigningOut = sessionStorage.getItem('signingOut') === 'true';
      if (!isSigningOut) {
        console.log('[Auth] Normal login, redirecting to dashboard');
        navigate("/dashboard");
      } else {
        // Clear the signing out flag
        sessionStorage.removeItem('signingOut');
      }
    }
  }, [user, session, navigate, isResettingPassword]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const validation = authSchema.omit({ fullName: true }).parse(signInData);
      const { error } = await signIn(validation.email, validation.password);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError("Invalid email or password");
        } else {
          setError(error.message);
        }
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const validation = authSchema.parse(signUpData);
      const result = await signUp(validation.email, validation.password, validation.fullName, validation.role);

      if (result.error) {
        if (result.error.message.includes("User already registered")) {
          setError("An account with this email already exists");
        } else {
          setError(result.error.message);
        }
      } else {
        setSuccess(result.message || "Account created successfully! Please check your email to verify your account.");
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      // Use the full URL without hash - Supabase will add its own tokens to the hash
      const redirectUrl = `${window.location.origin}/auth`;

      console.log('[Auth] Sending password reset email with redirect URL:', redirectUrl);

      // Store flag that recovery was initiated (with timestamp for expiration)
      sessionStorage.setItem('passwordRecoveryInitiated', 'true');
      sessionStorage.setItem('passwordRecoveryTimestamp', Date.now().toString());

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('[Auth] Password reset email error:', error);
        sessionStorage.removeItem('passwordRecoveryInitiated');
        sessionStorage.removeItem('passwordRecoveryTimestamp');
        toast.error(error.message);
      } else {
        toast.success("Password reset link sent! Check your email.", {
          description: "Make sure http://localhost:8083/auth is configured in Supabase Redirect URLs"
        });
        setShowForgotPassword(false);
        setResetEmail("");
      }
    } catch (err) {
      console.error('[Auth] Password reset exception:', err);
      toast.error("Failed to send reset email");
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    try {
      // First, ensure we have a valid session
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !currentSession) {
        console.error('[Auth] No session found for password update:', sessionError);
        setError("Session expired. Please request a new password reset link.");
        toast.error("Session expired. Please request a new password reset link.");
        setIsLoading(false);
        return;
      }

      console.log('[Auth] Updating password with session:', currentSession.user.id);
      console.log('[Auth] Session details:', {
        user: currentSession.user.email,
        expiresAt: currentSession.expires_at,
        tokenType: currentSession.token_type
      });

      // Update the password - this should work with a recovery session
      const { data: updateData, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('[Auth] Password update error:', error);
        setError(error.message);
        toast.error(error.message);
        setIsLoading(false);
        return;
      }

      console.log('[Auth] Password update response:', updateData);

      // Verify the password was actually updated
      if (!updateData?.user) {
        console.error('[Auth] Password update returned no user data');
        setError("Password update may have failed. Please try again.");
        toast.error("Password update may have failed. Please try again.");
        setIsLoading(false);
        return;
      }

      console.log('[Auth] Password updated successfully for user:', updateData.user.id);

      // Clear recovery flags from sessionStorage
      sessionStorage.removeItem('passwordRecoveryInitiated');
      sessionStorage.removeItem('passwordRecoveryTimestamp');

      // Verify the password change by attempting to sign in (optional verification)
      // Get the user's email from the session
      const userEmail = currentSession.user.email;

      if (userEmail) {
        // Sign out the recovery session first
        await supabase.auth.signOut();

        // Try to sign in with the new password to verify it worked
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: newPassword
        });

        if (signInError) {
          console.error('[Auth] Verification sign-in failed:', signInError);
          // Password might not have been updated, but don't show error to user
          // as the update call succeeded - might be a timing issue
          toast.warning("Password updated, but verification failed. Please try signing in.");
        } else {
          console.log('[Auth] Password verification successful - can sign in with new password');
          toast.success("Password updated successfully! Redirecting...");
        }
      } else {
        toast.success("Password updated successfully! Redirecting...");
      }

      // Clear the URL hash to remove the recovery token
      window.history.replaceState(null, '', window.location.pathname);

      // Redirect to dashboard (user is now signed in with new password)
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (err) {
      console.error('[Auth] Password update exception:', err);
      setError(err instanceof Error ? err.message : "Failed to update password");
      toast.error("Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  // Show password reset form if user clicked reset link
  if (isResettingPassword) {
    // Check if we have a session - if not, show a helpful message
    const hasValidSession = session && session.user;

    return (
      <div
        className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat relative"
        style={{ backgroundImage: `url(${loginBackground})` }}
      >
        <div className="absolute inset-0 bg-black/20" />

        <div className="relative z-10 w-full max-w-md mx-auto px-4">
          <Card className="w-full bg-black/40 backdrop-blur-sm border-gray-600">
            <CardHeader>
              <CardTitle className="text-white text-center text-2xl">Reset Your Password</CardTitle>
            </CardHeader>
            <CardContent>
              {!hasValidSession && (
                <Alert className="mb-4 border-yellow-500 bg-yellow-500/10">
                  <AlertDescription className="text-yellow-400 text-sm">
                    <strong>No active session detected.</strong> This usually means the redirect URL isn't configured in Supabase.
                    Please ensure <code className="text-xs bg-black/30 px-1 rounded">http://localhost:8083/auth</code> is added to your Supabase project's Redirect URLs.
                    <br /><br />
                    You can still try to update your password if you have a valid recovery session.
                  </AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-white">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500"
                    placeholder="Enter new password (min 6 characters)"
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-white">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500"
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                  />
                </div>
                {error && (
                  <Alert className="border-red-500 bg-red-500/10">
                    <AlertDescription className="text-red-400">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  type="submit"
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  disabled={isLoading || (!hasValidSession && !session)}
                >
                  {isLoading ? "Updating Password..." : "Update Password"}
                </Button>
                {!hasValidSession && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsResettingPassword(false);
                        sessionStorage.removeItem('passwordRecoveryInitiated');
                        sessionStorage.removeItem('passwordRecoveryTimestamp');
                      }}
                      className="text-sm text-gray-400 hover:text-gray-300 underline"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-no-repeat relative"
      style={{
        backgroundImage: `url(${loginBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "right top",
        backgroundColor: "#00963f"
      }}
    >
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 flex items-center justify-end">
        <div className="flex-1 flex justify-center lg:justify-end lg:mr-10">
          <Card className="w-full max-w-md bg-black/70 backdrop-blur-sm border-gray-600">
            <CardHeader>
              <CardTitle className="text-white text-center text-2xl">Welcome</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-black/20">
                  <TabsTrigger value="signin" className="text-white data-[state=active]:bg-green-500 data-[state=active]:text-white">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="text-white data-[state=active]:bg-green-500 data-[state=active]:text-white">
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="space-y-4">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-white">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        value={signInData.email}
                        onChange={(e) => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password" className="text-white">Password</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        value={signInData.password}
                        onChange={(e) => setSignInData(prev => ({ ...prev, password: e.target.value }))}
                        className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500"
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-green-500 hover:bg-green-600 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? "Signing In..." : "Sign In"}
                    </Button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-green-400 hover:text-green-300 underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="space-y-4">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-white">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        value={signUpData.fullName}
                        onChange={(e) => setSignUpData(prev => ({ ...prev, fullName: e.target.value }))}
                        className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-role" className="text-white">Role</Label>
                      <Select
                        value={signUpData.role}
                        onValueChange={(value: "agent" | "management" | "admin") =>
                          setSignUpData(prev => ({ ...prev, role: value }))
                        }
                      >
                        <SelectTrigger className="bg-transparent border-gray-500 text-white focus:border-green-500 focus:ring-green-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agent">Agent</SelectItem>
                          <SelectItem value="management">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-white">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={signUpData.email}
                        onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-white">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={signUpData.password}
                        onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                        className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500"
                        placeholder="Create a password (min 6 characters)"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-green-500 hover:bg-green-600 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? "Creating Account..." : "Sign Up"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {error && (
                <Alert className="mt-4 border-red-500 bg-red-500/10">
                  <AlertDescription className="text-red-400">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="mt-4 border-green-500 bg-green-500/10">
                  <AlertDescription className="text-green-400">
                    {success}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Reset Password</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-white">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500"
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotPassword(false)}
                className="flex-1 border-gray-600 text-white hover:bg-gray-800"
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                disabled={isResetting}
              >
                {isResetting ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;