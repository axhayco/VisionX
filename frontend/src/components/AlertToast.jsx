import React, { useEffect } from 'react'

export default function AlertToast({ message, onClose }) {
  useEffect(() => {
    // Automatically close the alert after 4 seconds
    const timer = setTimeout(() => {
      onClose()
    }, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="toast-banner">
      <span>🚨</span>
      <span>{message}</span>
      <button className="toast-close" onClick={onClose} aria-label="Close alert">
        ×
      </button>
    </div>
  )
}
