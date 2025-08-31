import React, { useState } from 'react'
import styles from './newsletter-signup.module.css'

const NewsletterSignup = ({ buttondownUsername = 'mkirkup', compact = false }) => {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('subscribing')

    try {
      const response = await fetch(
        `https://buttondown.email/api/emails/embed-subscribe/${buttondownUsername}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `email=${encodeURIComponent(email)}`,
        }
      )

      if (response.ok) {
        setStatus('success')
        setEmail('')
      } else {
        setStatus('error')
      }
    } catch (error) {
      setStatus('error')
    }
  }

  return (
    <div className={`${styles.newsletterSignup} ${compact ? styles.compact : ''}`}>
      <div className={styles.container}>
        {!compact && <h3 className={styles.title}>Subscribe to updates</h3>}
        <p className={styles.description}>
          {compact ? 'Get new posts in your inbox:' : 'Get new posts delivered directly to your inbox'}
        </p>
        
        {status === 'success' ? (
          <div className={styles.successMessage}>
            Thanks for subscribing! Check your email to confirm.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className={styles.input}
              required
              disabled={status === 'subscribing'}
            />
            <button 
              type="submit" 
              className={styles.button}
              disabled={status === 'subscribing'}
            >
              {status === 'subscribing' ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        )}
        
        {status === 'error' && (
          <div className={styles.errorMessage}>
            Something went wrong. Please try again.
          </div>
        )}
        
        {!compact && (
          <p className={styles.privacy}>
            No spam, unsubscribe anytime.
          </p>
        )}
      </div>
    </div>
  )
}

export default NewsletterSignup