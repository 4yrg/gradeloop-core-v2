"use client";

import * as React from "react";
import { Shield, Eye, EyeOff, Copy, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MFASetupPage() {
  const [step, setStep] = React.useState<"initial" | "verify" | "success">("initial");
  const [secret, setSecret] = React.useState("JBSWY3DPEHPK3PXP");
  const [code, setCode] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = () => {
    if (code.length === 6) {
      setStep("success");
    }
  };

  if (step === "success") {
    return (
      <div className="container mx-auto py-8 max-w-md">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">MFA Enabled Successfully</h2>
            <p className="text-muted-foreground mb-4">Your account is now protected with two-factor authentication.</p>
            <Button className="w-full" onClick={() => window.location.href = "/dashboard"}>
              Continue to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Setup Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "initial" && (
            <>
              <div className="space-y-2">
                <Label>Authenticator Secret</Label>
                <div className="flex gap-2">
                  <Input value={secret} readOnly className="font-mono" />
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">How to set up:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Copy the secret above</li>
                  <li>Open your authenticator app (Google Auth, Authy, etc.)</li>
                  <li>Add a new account using the secret</li>
                  <li>Enter the 6-digit code below to verify</li>
                </ol>
              </div>

              <Button className="w-full" onClick={() => setStep("verify")}>
                Continue
              </Button>
            </>
          )}

          {step === "verify" && (
            <>
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <Input
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                />
              </div>
              
              <p className="text-sm text-muted-foreground text-center">
                Enter the 6-digit code from your authenticator app
              </p>

              <Button className="w-full" onClick={handleVerify} disabled={code.length !== 6}>
                Verify & Enable MFA
              </Button>
              
              <Button variant="outline" className="w-full" onClick={() => setStep("initial")}>
                Back
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}