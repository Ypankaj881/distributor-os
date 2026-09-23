"use client";

import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { generatePassword } from "@/lib/generatePassword";

// Password input with a "Generate" button. Shown as plain text on purpose:
// the admin needs to read it out / send it to the shopkeeper.
export default function PasswordSetter({ value, onChange, error, label = "Password" }) {
  return (
    <div className="flex items-start gap-2">
      <Input
        className="flex-1"
        label={label}
        type="text"
        autoComplete="new-password"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        hint="At least 8 characters. Share it with the shopkeeper."
        inputClassName="font-mono"
      />
      <Button variant="secondary" className="mt-6 h-11" onClick={() => onChange(generatePassword())}>
        Generate
      </Button>
    </div>
  );
}
