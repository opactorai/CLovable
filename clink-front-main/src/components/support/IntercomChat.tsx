'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Intercom Live Chat Integration
 * Loads the Intercom messenger and hides the default launcher
 * The chat will be controlled by the HelpFAB component
 */
export function IntercomChat() {
  const { user } = useAuth();
  const intercomLoadedRef = useRef(false);

  // Load Intercom script once on mount
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    if (intercomLoadedRef.current) return;

    // Check if Intercom app ID is configured
    const intercomAppId = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;
    if (!intercomAppId) {
      console.warn('Intercom: NEXT_PUBLIC_INTERCOM_APP_ID not configured');
      return;
    }

    console.log('Loading Intercom with app ID:', intercomAppId);

    // Load Intercom script
    const script = document.createElement('script');
    script.innerHTML = `
      (function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){ic('reattach_activator');ic('update',w.intercomSettings);}else{var d=document;var i=function(){i.c(arguments);};i.q=[];i.c=function(args){i.q.push(args);};w.Intercom=i;var l=function(){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://widget.intercom.io/widget/${intercomAppId}';var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);};if(document.readyState==='complete'){l();}else if(w.attachEvent){w.attachEvent('onload',l);}else{w.addEventListener('load',l,false);}}})();
    `;
    document.head.appendChild(script);
    intercomLoadedRef.current = true;

    return () => {
      // Cleanup: shutdown Intercom on unmount
      try {
        if ((window as any).Intercom) {
          (window as any).Intercom('shutdown');
        }
      } catch (e) {
        // Silently ignore shutdown errors
        console.log('Intercom shutdown error (ignored):', e);
      }
    };
  }, []);

  // Update Intercom when user changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!intercomLoadedRef.current) return;

    const updateIntercomUser = async () => {
      let userHash: string | undefined;

      if (user) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/users/me/intercom-hash`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          const data = await response.json();
          userHash = data.userHash;
          console.log('Intercom user hash obtained');
        } catch (error) {
          console.warn('Failed to get Intercom user hash:', error);
        }
      }

      // Wait for Intercom to be available
      const checkIntercom = setInterval(() => {
        if ((window as any).Intercom) {
          try {
            const intercomAppId = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;
            const settings = {
              app_id: intercomAppId,
              ...(user && {
                email: user.email,
                name: user.name || user.email,
                user_id: user.id,
                ...(userHash && { user_hash: userHash }),
              }),
            };

            (window as any).Intercom('boot', settings);
            console.log('Intercom user updated');
          } catch (e) {
            console.log('Intercom update error:', e);
          }
          clearInterval(checkIntercom);
        }
      }, 100);

      setTimeout(() => clearInterval(checkIntercom), 10000);
    };

    updateIntercomUser();
  }, [user]);

  return null; // This component doesn't render anything
}
