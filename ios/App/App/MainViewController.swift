import Capacitor

@objc(MainViewController)
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SessionVaultPlugin())
    }
}
