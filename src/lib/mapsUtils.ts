/**
 * Detect the device OS based on user agent
 */
export function detectOS(): 'iOS' | 'Android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'iOS';
  }
  if (/android/.test(userAgent)) {
    return 'Android';
  }
  return 'other';
}

/**
 * Generate the appropriate maps URL based on device OS
 * iOS users get Apple Maps, others get Google Maps
 */
export function getMapsUrl(lat: number, lng: number, title?: string): string {
  const os = detectOS();
  
  if (os === 'iOS') {
    // Apple Maps scheme: maps://maps.apple.com/?q=latitude,longitude
    // Can also use &saddr for source or &daddr for destination
    const query = title ? encodeURIComponent(title) : `${lat},${lng}`;
    return `maps://maps.apple.com/?q=${query}&coord=${lat},${lng}`;
  } else {
    // Google Maps: works on Android and web browsers
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
}
