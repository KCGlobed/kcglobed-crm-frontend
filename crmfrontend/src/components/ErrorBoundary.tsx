import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './ui/feedback'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/** Route-level boundary: a crashed page never takes the shell down (SOW §6). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route error boundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          message="This page hit an unexpected error. The rest of the app is unaffected."
          onRetry={() => this.setState({ hasError: false })}
        />
      )
    }
    return this.props.children
  }
}
