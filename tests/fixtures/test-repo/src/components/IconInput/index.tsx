import React from "react";
import { Input } from "antd";

export interface IconInputProps {
  placeholder?: string;
  iconName?: string;
}

export default function IconInput(props: IconInputProps) {
  return <Input placeholder={props.placeholder} />;
}
