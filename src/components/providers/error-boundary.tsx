"use client";

import React from "react";
import { useTranslations } from "@/lib/i18n";

interface ErrorBoundaryState {
  hasError: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundaryInner extends React.Component<
  ErrorBoundaryProps & { t: (key: string) => string },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { t: (key: string) => string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{this.props.t("common.errorTitle")}</h1>
            <p className="text-muted-foreground mt-2">{this.props.t("common.errorDescription")}</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="bg-primary text-primary-foreground mt-4 rounded-md px-4 py-2 text-sm font-medium"
            >
              {this.props.t("common.errorRetry")}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const { t } = useTranslations();
  return <ErrorBoundaryInner t={t}>{children}</ErrorBoundaryInner>;
}
