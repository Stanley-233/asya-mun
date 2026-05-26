'use client'

import { ToastContainer } from 'react-toastify'

export function ToastProvider() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      draggable={false}
      pauseOnHover
      closeButton={false}
      icon={false}
      className="asya-toast-container"
      toastClassName="asya-toast"
      progressClassName="asya-toast-progress"
    />
  )
}
