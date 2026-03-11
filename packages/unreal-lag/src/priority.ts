/**
 * Priority packet marker support has been removed.
 *
 * The proxy no longer scans for magic bytes or provides a bypass mode.
 * If you are running ATC (Automated Test Coordinator) tests through a
 * network profile with high latency / loss, use
 * {@link logWarningIfNetworkProfileUnstable} at startup instead to get
 * a heads-up that coordination messages may arrive slowly.
 */
