package uk.co.thedogclub.member;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;

import org.json.JSONObject;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SessionVault")
public class SessionVaultPlugin extends Plugin {
    private static final String KEY_ALIAS = "dog_club_mobile_session";
    private static final String PREFERENCES = "dog_club_secure_session";
    private static final String CIPHERTEXT = "ciphertext";
    private static final String IV = "iv";

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        KeyStore.Entry existing = store.getEntry(KEY_ALIAS, null);
        if (existing instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) existing).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        );
        generator.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        );
        return generator.generateKey();
    }

    @PluginMethod
    public void set(PluginCall call) {
        String value = call.getString("value");
        if (value == null) {
            call.reject("A session value is required.");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            preferences()
                .edit()
                .putString(CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .apply();
            call.resolve();
        } catch (Exception error) {
            call.reject("The secure session could not be saved.", error);
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        String encryptedValue = preferences().getString(CIPHERTEXT, null);
        String ivValue = preferences().getString(IV, null);
        JSObject result = new JSObject();
        if (encryptedValue == null || ivValue == null) {
            result.put("value", JSONObject.NULL);
            call.resolve(result);
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                key(),
                new GCMParameterSpec(128, Base64.decode(ivValue, Base64.NO_WRAP))
            );
            byte[] plain = cipher.doFinal(Base64.decode(encryptedValue, Base64.NO_WRAP));
            result.put("value", new String(plain, StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception error) {
            preferences().edit().clear().apply();
            call.reject("The secure session could not be restored.", error);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        preferences().edit().clear().apply();
        call.resolve();
    }
}
