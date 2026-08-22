import { Component, type ErrorInfo, type ReactNode } from "react";

export class LegacyBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }

  render() {
    return this.state.failed ? <p>Failed</p> : this.props.children;
  }
}
