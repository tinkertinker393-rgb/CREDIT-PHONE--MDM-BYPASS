package com.titan.mdm.agent;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.google.firebase.firestore.DocumentChange;
import com.google.firebase.firestore.EventListener;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreException;
import com.google.firebase.firestore.QuerySnapshot;

import java.util.HashMap;
import java.util.Map;

/**
 * TITAN MDM AGENT - ANDROID IMPLEMENTATION GUIDE
 * 
 * This class demonstrates how the Android app listens for commands 
 * from the Titan MDM Console via Firestore.
 */
public class MdmServiceActivity extends AppCompatActivity {
    private static final String TAG = "TitanMdmAgent";
    private FirebaseFirestore db;
    private DevicePolicyManager dpm;
    private ComponentName adminComponent;
    private String deviceId = "R7AW404SS2A"; // Unique ID for this device

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        db = FirebaseFirestore.getInstance();
        dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        adminComponent = new ComponentName(this, MyDeviceAdminReceiver.class);

        startCommandListener();
    }

    private void startCommandListener() {
        // Listen for pending commands assigned to this device
        db.collection("commands")
            .whereEqualTo("deviceId", deviceId)
            .whereEqualTo("status", "pending")
            .addSnapshotListener(new EventListener<QuerySnapshot>() {
                @Override
                public void onEvent(@Nullable QuerySnapshot snapshots, @Nullable FirebaseFirestoreException e) {
                    if (e != null) {
                        Log.w(TAG, "Listen failed.", e);
                        return;
                    }

                    for (DocumentChange dc : snapshots.getDocumentChanges()) {
                        if (dc.getType() == DocumentChange.Type.ADDED) {
                            String cmdId = dc.getDocument().getId();
                            String type = dc.getDocument().getString("type");
                            executeCommand(cmdId, type);
                        }
                    }
                }
            });
    }

    private void executeCommand(String cmdId, String type) {
        Log.d(TAG, "Executing command: " + type);
        
        // 1. Mark as 'sent' (Acknowledged)
        db.collection("commands").document(cmdId).update("status", "sent");

        try {
            switch (type) {
                case "wipe":
                case "factory_reset":
                    if (dpm.isAdminActive(adminComponent)) {
                        // REAL WIPE: This will factory reset the phone
                        dpm.wipeData(0); 
                    }
                    break;

                case "lock":
                    if (dpm.isAdminActive(adminComponent)) {
                        dpm.lockNow();
                    }
                    break;

                case "reboot":
                    // Requires Device Owner or System privileges
                    // dpm.reboot(adminComponent);
                    break;

                case "mdm_bypass":
                    // Custom logic to disable restrictions
                    break;
            }

            // 2. Mark as 'completed'
            db.collection("commands").document(cmdId).update("status", "completed");
            
        } catch (Exception e) {
            db.collection("commands").document(cmdId).update("status", "failed");
        }
    }
}
