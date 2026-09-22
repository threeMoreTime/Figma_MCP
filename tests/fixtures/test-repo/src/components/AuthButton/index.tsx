import React from "react";
import { Button } from "antd";
// Deliberately imports uninstalled monorepo dependency to verify UNVERIFIED_EXTERNAL_DEPENDENCY
import { checkPermission } from "@monorepo/utils";

export interface AuthButtonProps {
  permission: string;
  type?: "primary" | "default" | "link";
  children?: React.ReactNode;
}

export default function AuthButton(props: AuthButtonProps) {
  if (typeof checkPermission === "function" && !checkPermission(props.permission)) {
    return null;
  }
  return <Button type={props.type}>{props.children}</Button>;
}
