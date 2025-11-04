'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Marker.io Bug Reporting Widget Integration
 * Loads the Marker.io widget and hides the default button
 * The widget will be controlled by the HelpFAB component
 */
export function MarkerWidget() {
  const { user } = useAuth();
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Check if Marker project ID is configured
    const markerProjectId = process.env.NEXT_PUBLIC_MARKER_PROJECT_ID;
    if (!markerProjectId) {
      console.warn('Marker.io: NEXT_PUBLIC_MARKER_PROJECT_ID not configured');
      return;
    }

    // Update user reporter when user changes
    if ((window as any).Marker && user) {
      try {
        (window as any).Marker.setReporter({
          email: user.email,
          fullName: user.name || user.email,
          userId: user.id,
          plan: user.plan,
        });
        console.log('Marker.io user updated:', user.email);
      } catch (e) {
        console.log('Marker.io setReporter error:', e);
      }
    }

    // Don't add CSS yet - will hide after widget loads

    // Load Marker.io widget using script injection
    const script = document.createElement('script');
    script.innerHTML = `
      window.markerConfig = {
        project: '${markerProjectId}',
        source: 'snippet'
      };
    `;
    document.head.appendChild(script);

    const markerScript = document.createElement('script');
    markerScript.src = 'https://edge.marker.io/latest/shim.js';
    markerScript.async = true;
    markerScript.onload = () => {
      console.log('Marker.io script loaded');
      // Try to hide via API and set user reporter
      const checkMarker = setInterval(() => {
        if ((window as any).Marker) {
          try {
            // Hide the default widget
            (window as any).Marker.hide();
            console.log('Marker.io widget hidden via API');

            // Set user information for bug reports
            if (user) {
              (window as any).Marker.setReporter({
                email: user.email,
                fullName: user.name || user.email,
                userId: user.id,
                // Additional custom data
                plan: user.plan,
              });
              console.log('Marker.io user set:', user.email);
            }
          } catch (e) {
            console.log('Marker.io API error:', e);
          }
          clearInterval(checkMarker);
        }
      }, 50);

      setTimeout(() => clearInterval(checkMarker), 10000);
    };
    markerScript.onerror = () => {
      console.error('Failed to load Marker.io script');
    };
    document.head.appendChild(markerScript);

    return () => {
      // Cleanup: unload Marker on unmount
      try {
        if ((window as any).Marker?.unload) {
          (window as any).Marker.unload();
        }
      } catch (e) {
        // Silently ignore unload errors
        console.log('Marker.io unload error (ignored):', e);
      }
    };
  }, [user]); // Re-run when user changes

  return null; // This component doesn't render anything
}
