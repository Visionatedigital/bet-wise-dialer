import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  Phone, 
  Key, 
  CheckCircle, 
  XCircle, 
  Settings, 
  Zap,
  MessageSquare,
  Brain,
  Mic
} from "lucide-react";

const Integrations = () => {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState({
    openai: { enabled: false, apiKey: "", status: "disconnected" },
    anthropic: { enabled: false, apiKey: "", status: "disconnected" },
    elevenlabs: { enabled: false, apiKey: "", status: "disconnected" },
    infobip: { enabled: false, apiKey: "", baseUrl: "", status: "disconnected" }
  });

  const handleApiKeyChange = (service: string, field: string, value: string) => {
    setIntegrations(prev => ({
      ...prev,
      [service]: {
        ...prev[service as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const handleConnect = async (service: string) => {
    const integration = integrations[service as keyof typeof integrations];
    
    if (!integration.apiKey) {
      toast({
        title: "Error",
        description: "Please enter your API key",
        variant: "destructive",
      });
      return;
    }

    // Simulate API key validation
    try {
      // In a real app, you would validate the API key here
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIntegrations(prev => ({
        ...prev,
        [service]: {
          ...prev[service as keyof typeof prev],
          enabled: true,
          status: "connected"
        }
      }));

      toast({
        title: "Connected",
        description: `Successfully connected to ${service}`,
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Please check your API key and try again",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = (service: string) => {
    setIntegrations(prev => ({
      ...prev,
      [service]: {
        ...prev[service as keyof typeof prev],
        enabled: false,
        status: "disconnected"
      }
    }));

    toast({
      title: "Disconnected",
      description: `Disconnected from ${service}`,
    });
  };

  const getStatusIcon = (status: string) => {
    return status === "connected" ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === "connected" ? "default" : "secondary"}>
        {status === "connected" ? "Connected" : "Disconnected"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external services to enhance your call center capabilities
        </p>
      </div>

      {/* Security Notice */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-amber-800 dark:text-amber-200">Security Notice</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-amber-700 dark:text-amber-300">
            For production use, we recommend connecting to Supabase to securely store your API keys. 
            The keys entered here are stored locally for development purposes only.
          </p>
        </CardContent>
      </Card>

      {/* AI Services */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5" />
          <h2 className="text-xl font-semibold">AI Services</h2>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {/* OpenAI */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  <CardTitle>OpenAI</CardTitle>
                  {getStatusIcon(integrations.openai.status)}
                </div>
                {getStatusBadge(integrations.openai.status)}
              </div>
              <CardDescription>
                Integrate GPT models for call analysis, summaries, and AI insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openai-key">API Key</Label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-..."
                  value={integrations.openai.apiKey}
                  onChange={(e) => handleApiKeyChange("openai", "apiKey", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={integrations.openai.enabled}
                    onCheckedChange={(checked) => 
                      checked ? handleConnect("openai") : handleDisconnect("openai")
                    }
                  />
                  <Label>Enable OpenAI</Label>
                </div>
                {integrations.openai.enabled && (
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Anthropic Claude */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  <CardTitle>Anthropic Claude</CardTitle>
                  {getStatusIcon(integrations.anthropic.status)}
                </div>
                {getStatusBadge(integrations.anthropic.status)}
              </div>
              <CardDescription>
                Use Claude for advanced conversation analysis and coaching insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="anthropic-key">API Key</Label>
                <Input
                  id="anthropic-key"
                  type="password"
                  placeholder="sk-ant-..."
                  value={integrations.anthropic.apiKey}
                  onChange={(e) => handleApiKeyChange("anthropic", "apiKey", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={integrations.anthropic.enabled}
                    onCheckedChange={(checked) => 
                      checked ? handleConnect("anthropic") : handleDisconnect("anthropic")
                    }
                  />
                  <Label>Enable Claude</Label>
                </div>
                {integrations.anthropic.enabled && (
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ElevenLabs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  <CardTitle>ElevenLabs</CardTitle>
                  {getStatusIcon(integrations.elevenlabs.status)}
                </div>
                {getStatusBadge(integrations.elevenlabs.status)}
              </div>
              <CardDescription>
                Add realistic text-to-speech capabilities for automated responses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="elevenlabs-key">API Key</Label>
                <Input
                  id="elevenlabs-key"
                  type="password"
                  placeholder="Enter ElevenLabs API key"
                  value={integrations.elevenlabs.apiKey}
                  onChange={(e) => handleApiKeyChange("elevenlabs", "apiKey", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={integrations.elevenlabs.enabled}
                    onCheckedChange={(checked) => 
                      checked ? handleConnect("elevenlabs") : handleDisconnect("elevenlabs")
                    }
                  />
                  <Label>Enable ElevenLabs</Label>
                </div>
                {integrations.elevenlabs.enabled && (
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Communication Services */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Phone className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Communication Services</h2>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                <CardTitle>Infobip</CardTitle>
                {getStatusIcon(integrations.infobip.status)}
              </div>
              {getStatusBadge(integrations.infobip.status)}
            </div>
            <CardDescription>
              Connect your Infobip account for voice calls, SMS, and communication APIs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="infobip-key">API Key</Label>
                <Input
                  id="infobip-key"
                  type="password"
                  placeholder="Enter Infobip API key"
                  value={integrations.infobip.apiKey}
                  onChange={(e) => handleApiKeyChange("infobip", "apiKey", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="infobip-url">Base URL</Label>
                <Input
                  id="infobip-url"
                  placeholder="https://api.infobip.com"
                  value={integrations.infobip.baseUrl}
                  onChange={(e) => handleApiKeyChange("infobip", "baseUrl", e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={integrations.infobip.enabled}
                  onCheckedChange={(checked) => 
                    checked ? handleConnect("infobip") : handleDisconnect("infobip")
                  }
                />
                <Label>Enable Infobip</Label>
              </div>
              {integrations.infobip.enabled && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                  <Button variant="outline" size="sm">
                    Test Connection
                  </Button>
                </div>
              )}
            </div>

            {integrations.infobip.enabled && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Available Features:</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Voice calls and conferencing</li>
                  <li>• SMS and WhatsApp messaging</li>
                  <li>• Call recording and transcription</li>
                  <li>• Real-time call monitoring</li>
                  <li>• Advanced call routing</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <CardTitle>Quick Actions</CardTitle>
          </div>
          <CardDescription>
            Common integration tasks and utilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              Test All Connections
            </Button>
            <Button variant="outline" size="sm">
              Export Configuration
            </Button>
            <Button variant="outline" size="sm">
              Import Configuration
            </Button>
            <Button variant="outline" size="sm">
              View Logs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Integrations;