import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
          <div className="flex flex-col items-center max-w-md text-center space-y-4">
            <div className="bg-destructive/10 p-4 rounded-full">
              <AlertTriangle className="w-12 h-12 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold">Algo salió mal</h2>
            <p className="text-muted-foreground text-sm">
              Ha ocurrido un error inesperado. Por favor, intenta reiniciar la aplicación.
            </p>
            {this.state.error && (
              <pre className="text-xs bg-muted p-2 rounded w-full overflow-auto text-left">
                {this.state.error.toString()}
              </pre>
            )}
            <Button
              onClick={() => window.location.reload()}
              variant="default"
              className="mt-4"
            >
              Recargar Aplicación
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
