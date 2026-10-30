import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './ui/feedback'
import { isStaleChunkError, reloadForNewBuild } from '../lib/staleBuild'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  /** the page's code is from a build that has since been replaced (a deploy while the tab was open) */
  staleBuild: boolean
}

/** Route-level boundary: a crashed page never takes the shell down (SOW §6). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, staleBuild: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, staleBuild: isStaleChunkError(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // a missing chunk of the old build is not a bug in the page: reload into the new build
    if (this.state.staleBuild && reloadForNewBuild()) return
    console.error('Route error boundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.staleBuild) {
      return <ErrorState message="A new version of the CRM was just released. Reload to pick it up." onRetry={() => window.location.reload()} />
    }
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
