import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import loginBackground from "@/assets/login-background.png";
import betsureLogo from "@/assets/betsure-logo.png";
import { useNavigate } from "react-router-dom";

const SignIn = () => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For demo purposes, just navigate to dashboard
    navigate("/dashboard");
  };

  const handleInputChange = (field: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${loginBackground})` }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/20" />
      
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 flex items-center justify-between">
        {/* Left side - Logo */}
        <div className="flex-1 flex justify-center lg:justify-start">
          <div className="flex items-center justify-center">
            {/* Logo image */}
            <img 
              src={betsureLogo} 
              alt="Betsure Logo" 
              className="w-32 h-32 object-contain"
            />
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="flex-1 flex justify-center lg:justify-end">
          <Card className="w-full max-w-md bg-black/40 backdrop-blur-sm border-gray-600">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-white text-base">
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={credentials.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    className="h-12 bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500"
                    placeholder="Enter your username"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white text-base">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={credentials.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className="h-12 bg-transparent border-gray-500 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500"
                    placeholder="Enter your password"
                    required
                  />
                </div>

                <Button 
                  type="submit"
                  className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-semibold text-base tracking-wide"
                >
                  SIGN IN
                </Button>

                <div className="text-center">
                  <a href="#" className="text-sm text-gray-300 hover:text-white">
                    Forgot your password?
                  </a>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SignIn;