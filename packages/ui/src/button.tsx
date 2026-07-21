"use client";

import * as React from "react";
import { Button as ShadcnButton } from "./components/ui/button";

interface ButtonProps extends React.ComponentProps<typeof ShadcnButton> {
  appName?: string;
}

export const Button = ({ appName, onClick, ...props }: ButtonProps) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (appName) {
      alert(`Hello from your ${appName} app!`);
    }
    if (onClick) {
      onClick(e);
    }
  };

  return <ShadcnButton onClick={handleClick} {...props} />;
};
