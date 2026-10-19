export function adminSessionDevice(userAgent?: string | null) {
    const ua = userAgent || ''
    const browser = /Edg(?:e|A|iOS)?\//.test(ua)
        ? 'Edge'
        : /(?:OPR|Opera)\//.test(ua)
          ? 'Opera'
          : /(?:Firefox|FxiOS)\//.test(ua)
            ? 'Firefox'
            : /(?:Chrome|CriOS)\//.test(ua)
              ? 'Chrome'
              : /Version\/.+Safari\//.test(ua)
                ? 'Safari'
                : 'Unknown browser'
    const os = /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Macintosh|Mac OS X/.test(ua)
              ? 'macOS'
              : /CrOS/.test(ua)
                ? 'ChromeOS'
                : /Linux/.test(ua)
                  ? 'Linux'
                  : 'Unknown OS'
    const tablet = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
    const mobile = /Mobile|iPhone|iPod/.test(ua)
    const device = tablet
        ? 'Tablet'
        : mobile
          ? 'Phone'
          : os !== 'Unknown OS'
            ? 'Computer'
            : 'Unknown device'
    const icon = tablet
        ? 'mingcute:pad-line'
        : mobile
          ? 'mingcute:cellphone-line'
          : 'mingcute:computer-line'
    return { browser, os, device, icon }
}
