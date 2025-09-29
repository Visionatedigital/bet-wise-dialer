import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import loginBackground from "@/assets/login-background.png";
import betsureLogo from "@/assets/betsure-logo.png";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().optional(),
});

const Auth = () => {
  const [signInData, setSignInData] = useState({
    email: "",
    password: ""
  });
  
  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    fullName: ""
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const validateForm = (data: any, includeFullName = false) => {
    try {
      const schema = includeFullName 
        ? authSchema.extend({ fullName: z.string().min(1, "Full name is required") })
        : authSchema.pick({ email: true, password: true });
      
      schema.parse(data);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMap: { [key: string]: string } = {};
        error.errors.forEach((err) => {
          if (err.path) {
            errorMap[err.path[0]] = err.message;
          }
        });
        setErrors(errorMap);
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm(signInData)) return;
    
    setLoading(true);
    const { error } = await signIn(signInData.email, signInData.password);
    setLoading(false);
    
    if (!error) {
      navigate("/dashboard");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm(signUpData, true)) return;
    
    setLoading(true);
    const { error } = await signUp(signUpData.email, signUpData.password, signUpData.fullName);
    setLoading(false);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${loginBackground})` }}
    >
      <div className="absolute inset-0 bg-black/20" />
      
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 flex items-center justify-between">
        <div className="flex-1 flex justify-center lg:justify-start">
          <div className="flex items-center justify-center">
            <img 
              src={betsureLogo} 
              alt="Betsure Logo" 
              className="w-96 h-96 object-contain"
            />
          </div>
        </div>

        <div className="flex-1 flex justify-center lg:justify-end">
          <Card className="w-full max-w-md bg-black/40 backdrop-blur-sm border-gray-600">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-center text-2xl">Welcome</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              <Tabs defaultValue="signin" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 bg-gray-700">
                  <TabsTrigger value="signin" className="text-white data-[state=active]:bg-green-600">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="text-white data-[state=active]:bg-green-600">
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-white">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        value={signInData.email}
                        onChange={(e) => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500"
                        placeholder="Enter your email"
                        required
                      />
                      {errors.email && <p className="text-red-400 text-sm">{errors.email}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signin-password" className="text-white">Password</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        value={signInData.password}
                        onChange={(e) => setSignInData(prev => ({ ...prev, password: e.target.value }))}
                        className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500"
                        placeholder="Enter your password"
                        required
                      />
                      {errors.password && <p className="text-red-400 text-sm">{errors.password}</p>}
                    </div>

                    <Button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold"
                    >
                      {loading ? "Signing In..." : "Sign In"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-white">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        value={signUpData.fullName}
                        onChange={(e) => setSignUpData(prev => ({ ...prev, fullName: e.target.value }))}
                        className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500"
                        placeholder="Enter your full name"
                        required
                      />
                      {errors.fullName && <p className="text-red-400 text-sm">{errors.fullName}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-white">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={signUpData.email}
                        onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500"
                        placeholder="Enter your email"
                        required
                      />
                      {errors.email && <p className="text-red-400 text-sm">{errors.email}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-white">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={signUpData.password}
                        onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                        className="bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500"
                        placeholder="Choose a password"
                        required
                      />
                      {errors.password && <p className="text-red-400 text-sm">{errors.password}</p>}
                    </div>

                    <Button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold"
                    >
                      {loading ? "Creating Account..." : "Sign Up"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;