import Capacitor
import Foundation
import Security

@objc(SessionVaultPlugin)
public class SessionVaultPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SessionVaultPlugin"
    public let jsName = "SessionVault"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    private let service = "uk.co.thedogclub.member.session"
    private let account = "mobile-session"

    private func query() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let value = call.getString("value"), let data = value.data(using: .utf8) else {
            call.reject("A session value is required.")
            return
        }
        SecItemDelete(query() as CFDictionary)
        var item = query()
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else {
            call.reject("The secure session could not be saved.", "KEYCHAIN_\(status)")
            return
        }
        call.resolve()
    }

    @objc func get(_ call: CAPPluginCall) {
        var item = query()
        item[kSecReturnData as String] = true
        item[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(item as CFDictionary, &result)
        if status == errSecItemNotFound {
            call.resolve(["value": NSNull()])
            return
        }
        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            call.reject("The secure session could not be restored.", "KEYCHAIN_\(status)")
            return
        }
        call.resolve(["value": value])
    }

    @objc func clear(_ call: CAPPluginCall) {
        let status = SecItemDelete(query() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            call.reject("The secure session could not be cleared.", "KEYCHAIN_\(status)")
            return
        }
        call.resolve()
    }
}
