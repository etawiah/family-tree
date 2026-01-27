import React from "react";
import { useNavigate } from "react-router-dom";

/**
 * Error Boundary component that catches JavaScript errors anywhere in the component tree
 * and displays a user-friendly error page with retry and home navigation options.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error);
    console.error("Error info:", errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="page error-boundary-page">
          <div className="error-boundary-content">
            <h1>Something went wrong</h1>
            <p className="error-boundary-message">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            {process.env.NODE_ENV === "development" && (
              <details className="error-boundary-details">
                <summary>Error details (development only)</summary>
                <pre className="error-boundary-stack">
                  {this.state.error?.toString()}
                </pre>
              </details>
            )}
            <div className="error-boundary-actions">
              <button type="button" onClick={this.handleRetry} className="button-primary">
                Refresh Page
              </button>
              <button type="button" onClick={this.handleGoHome} className="button-secondary">
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
