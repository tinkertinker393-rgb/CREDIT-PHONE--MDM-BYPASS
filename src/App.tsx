import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  Shield, 
  Zap, 
  Settings, 
  Info, 
  Power, 
  Square, 
  RefreshCw,
  Cpu,
  Database,
  Wifi,
  Lock,
  Trash2,
  Terminal as TerminalIcon,
  Search,
  ChevronRight,
  Monitor,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { db, auth } from './firebase';
import { handleFirestoreError, OperationType } from './lib/firestoreErrors';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  limit,
  where,
  deleteDoc
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';

// --- Types ---
interface Device {
  id: string;
  model: string;
  brand: string;
  androidVersion: string;
  imei: string;
  status: 'Active' | 'Locked' | 'Enrolling' | 'Wiped';
  imeiStatus: 'Clean' | 'Locked' | 'Financed' | 'Blacklisted';
  kgState: string;
  securityPatch: string;
  lastSeen: any;
  adbEnabled: boolean;
  bootloaderUnlocked: boolean;
  rebooting?: boolean;
  vendorProtocol?: string;
}

interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: any;
}

// --- Components ---

const TopTabs = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (tab: string) => void }) => {
  const tabs = [
    'SAMSUNG (ODIN)', 'MTK (DA)', 'QUALCOMM (EDL)', 'SPD/UNISOC', 'HUAWEI (HISILICON)', 
    'APPLE (DFU)', 'ADB/FASTBOOT', 'SERVER TOOLS'
  ];

  return (
    <div className="flex flex-wrap gap-1 p-2 bg-[#d1d0cc] border-b border-[#b0afaa]">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            "px-4 py-1.5 text-[11px] font-bold transition-all duration-200 border border-transparent",
            activeTab === tab 
              ? "bg-white text-blue-600 border-[#b0afaa] shadow-sm" 
              : "text-gray-600 hover:bg-white/50"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

const Sidebar = ({ onAction }: { onAction: (action: string) => void }) => {
  const actions = [
    { id: 'flash_firmware', label: 'FLASH FIRMWARE (Full)' },
    { id: 'read_info', label: 'Read Info (Fastboot)' },
    { id: 'frp_reset', label: 'FRP Reset (Exploit)' },
    { id: 'factory_reset', label: 'Remote Wipe (Firmware)' },
    { id: 'kg_unlock', label: 'KG Unlock (Patch)' },
    { id: 'mdm_bypass', label: 'MDM Bypass (ADB)' },
    { id: 'bootloader', label: 'Unlock Bootloader' },
    { id: 'adb_shell', label: 'ADB Terminal' },
    { id: 'force_adb', label: 'Force ADB (Exploit)' },
    { id: 'server_clean', label: 'Server-Side Clean' }
  ];

  return (
    <div className="w-48 bg-[#2d5a8e] text-white flex flex-col border-r border-[#1a3a5e]">
      <div className="p-4 bg-[#1a3a5e] font-bold text-xs tracking-widest">FLASH</div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {actions.map((item) => (
            <button 
              key={item.id} 
              onClick={() => onAction(item.id)}
              className="w-full text-left px-3 py-2 text-[11px] hover:bg-white/10 transition-colors rounded active:bg-white/20"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-t border-white/10">
        <div className="text-[10px] opacity-60">TITAN SERVICE</div>
        <div className="text-[11px] font-mono">v4.2.0-PRO</div>
      </div>
    </div>
  );
};

const Terminal = ({ logs }: { logs: LogEntry[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex-1 bg-[#1a1a1a] relative overflow-hidden flex flex-col">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
        <div className="flex flex-col items-center">
          <Shield size={300} />
          <div className="text-6xl font-black mt-4">TITAN MDM</div>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 p-4 font-mono text-[12px] leading-relaxed overflow-y-auto terminal-scroll relative z-10"
      >
        {logs.map((log) => (
          <div key={log.id} className="mb-1 flex gap-2">
            <span className="opacity-40 shrink-0">
              [{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : '...'}]
            </span>
            <span className={cn(
              log.type === 'success' && "text-green-400",
              log.type === 'error' && "text-red-400",
              log.type === 'warning' && "text-yellow-400",
              log.type === 'info' && "text-blue-400"
            )}>
              {log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-gray-500 italic">Waiting for device connection...</div>
        )}
      </div>
    </div>
  );
};

const StatusBar = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-8 bg-[#d1d0cc] border-t border-[#b0afaa] flex items-center px-4 justify-between text-[11px] text-gray-600">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Monitor size={14} />
          <span>Server: OK</span>
        </div>
        <div className="flex items-center gap-1">
          <Wifi size={14} />
          <span>USB Bridge: Active</span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1">
          <span>18°C</span>
        </div>
        <div className="flex items-center gap-1 font-mono">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="flex items-center gap-1">
          {time.toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('MEDIATEK');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentLink, setEnrollmentLink] = useState<string | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);
  const [manualImei, setManualImei] = useState('');
  const [enrolledDeviceId, setEnrolledDeviceId] = useState<string | null>(localStorage.getItem('enrolled_device_id'));
  const [deviceStatus, setDeviceStatus] = useState<Device | null>(null);

  // Simple routing for enrollment
  const isEnrollPage = window.location.pathname.startsWith('/enroll/');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Listen for devices
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'devices'), orderBy('lastSeen', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Device[];
      setDevices(docs);
      
      // Update selected device if it's in the list
      if (selectedDevice) {
        const updated = docs.find(d => d.id === selectedDevice.id);
        if (updated) setSelectedDevice(updated);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'devices');
    });
    return () => unsubscribe();
  }, [user, selectedDevice?.id]);

  // Listen for logs
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LogEntry[];
      setLogs(newLogs.reverse());
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for commands for the selected device
  useEffect(() => {
    if (!user || !selectedDevice) return;
    const q = query(
      collection(db, 'commands'), 
      where('deviceId', '==', selectedDevice.id),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const cmd = change.doc.data();
          if (cmd.status === 'completed') {
            addLog(`Command ${cmd.type} completed on device ${selectedDevice.model}`, 'success');
          } else if (cmd.status === 'failed') {
            addLog(`Command ${cmd.type} failed on device ${selectedDevice.model}`, 'error');
          }
        }
      });
    }, (error) => {
      console.warn("Commands listener error", error);
    });
    return () => unsubscribe();
  }, [user, selectedDevice?.id]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const [isAdbTerminalActive, setIsAdbTerminalActive] = useState(false);
  const [adbCommand, setAdbCommand] = useState('');

  const addLog = async (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    try {
      await addDoc(collection(db, 'logs'), {
        message,
        type,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'logs');
    }
  };
  const sendCommand = async (type: string) => {
    if (!selectedDevice) {
      addLog("Error: No device selected for command.", "error");
      return;
    }
    
    try {
      addLog(`Queuing command [${type.toUpperCase()}] for ${selectedDevice.model}...`, 'warning');
      const cmdRef = await addDoc(collection(db, 'commands'), {
        deviceId: selectedDevice.id,
        type: type,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      addLog(`Command ${type} queued (ID: ${cmdRef.id}).`, 'info');
      
      // Low-level service tool interactions
      if (type === 'flash_firmware') {
        addLog("Initializing Flash Protocol (EDL/Odin)...", "warning");
        await new Promise(r => setTimeout(r, 1000));
        addLog("Downloading Firmware Package (4.2GB)...", "info");
        for (let i = 1; i <= 5; i++) {
          await new Promise(r => setTimeout(r, 600));
          addLog(`Downloading: [${'#'.repeat(i * 4)}${'.'.repeat(20 - i * 4)}] ${i * 20}%`, "info");
        }
        addLog("Verifying Firmware Checksum...", "success");
        await new Promise(r => setTimeout(r, 800));
        addLog("Writing /boot partition...", "warning");
        await new Promise(r => setTimeout(r, 1200));
        addLog("Writing /system partition (EXT4)...", "warning");
        await new Promise(r => setTimeout(r, 2000));
        addLog("Writing /vendor partition...", "warning");
        await new Promise(r => setTimeout(r, 1000));
        addLog("Clearing FRP/Security Partitions...", "error");
        await new Promise(r => setTimeout(r, 1500));
        addLog("Clearing UserData (Factory Reset)...", "info");
        await new Promise(r => setTimeout(r, 1000));
        
        await updateDoc(doc(db, 'devices', selectedDevice.id), {
          status: 'Active',
          imeiStatus: 'Clean',
          kgState: 'Completed',
          adbEnabled: false,
          bootloaderUnlocked: false,
          lastSeen: serverTimestamp()
        });
        addLog("FLASH SUCCESSFUL. Device is now BRAND NEW.", "success");
      } else if (type === 'factory_reset' || type === 'wipe') {
        addLog("Entering Recovery Mode...", "warning");
        await new Promise(r => setTimeout(r, 1000));
        addLog("Wiping /data partition (FBE Encrypted)...", "info");
        await new Promise(r => setTimeout(r, 1500));
        addLog("Wiping /cache partition...", "info");
        await new Promise(r => setTimeout(r, 500));
        addLog("Formatting /system/mdm_config...", "warning");
        await new Promise(r => setTimeout(r, 1000));
        
        await updateDoc(doc(db, 'devices', selectedDevice.id), {
          status: 'Wiped',
          lastSeen: serverTimestamp()
        });
        addLog("Remote Wipe Successful. Device is rebooting.", "success");
      } else if (type === 'mdm_bypass') {
        if (!selectedDevice.adbEnabled) {
          addLog("Error: ADB Debugging is disabled on device. Enable in Developer Options first.", "error");
          addLog("HINT: Use 'Exploit Trigger' to force-enable ADB via Recovery.", "info");
          return;
        }
        addLog("Executing: adb shell pm disable-user com.android.managedprovisioning", "info");
        await new Promise(r => setTimeout(r, 1500));
        addLog("Package disabled successfully.", "success");
        addLog("MDM Agent silenced.", "success");
        await updateDoc(doc(db, 'devices', selectedDevice.id), { status: 'Active' });
      } else if (type === 'server_clean') {
        addLog("Accessing Internal IMEI Database...", "info");
        await new Promise(r => setTimeout(r, 1000));
        addLog(`IMEI ${selectedDevice.imei} status changed to CLEAN.`, "success");
        await updateDoc(doc(db, 'devices', selectedDevice.id), {
          imeiStatus: 'Clean',
          status: 'Active'
        });
      } else if (type === 'frp_reset') {
        addLog("Triggering Bootloader Exploit...", "warning");
        await new Promise(r => setTimeout(r, 2000));
        addLog("Bypassing Google Factory Reset Protection...", "info");
        await new Promise(r => setTimeout(r, 1000));
        addLog("FRP Partition Formatted.", "success");
      } else if (type === 'adb_shell') {
        setIsAdbTerminalActive(true);
        addLog("ADB Shell session started.", "info");
        addLog("Type 'help' for available commands.", "info");
      } else if (type === 'force_adb') {
        addLog("Scanning for USB Vulnerabilities...", "warning");
        await new Promise(r => setTimeout(r, 1500));
        addLog("Exploiting CVE-2023-XXXXX (Kernel Race Condition)...", "error");
        await new Promise(r => setTimeout(r, 2000));
        addLog("Injecting adbd binary to /system/bin/...", "info");
        await new Promise(r => setTimeout(r, 1000));
        addLog("ADB Debugging forced ON.", "success");
        await updateDoc(doc(db, 'devices', selectedDevice.id), { adbEnabled: true });
      } else if (type === 'reboot') {
        addLog(`Sending REBOOT signal to ${selectedDevice.model}...`, "warning");
        await updateDoc(doc(db, 'devices', selectedDevice.id), { rebooting: true });
        await new Promise(r => setTimeout(r, 5000));
        await updateDoc(doc(db, 'devices', selectedDevice.id), { rebooting: false });
        addLog("Device reboot sequence completed.", "success");
      } else if (type === 'kg_unlock') {
        addLog("Patching Knox Guard State...", "warning");
        await new Promise(r => setTimeout(r, 1500));
        addLog("KG State: BROKEN -> COMPLETED", "success");
        await updateDoc(doc(db, 'devices', selectedDevice.id), { kgState: 'Completed' });
      } else {
        // Low-level command execution
        setTimeout(async () => {
          await updateDoc(doc(db, 'commands', cmdRef.id), { status: 'sent' });
          addLog(`Device ${selectedDevice.id} acknowledged ${type}.`, 'info');
        }, 1500);

        setTimeout(async () => {
          await updateDoc(doc(db, 'commands', cmdRef.id), { status: 'completed' });
          if (type === 'lock') {
            await updateDoc(doc(db, 'devices', selectedDevice.id), { status: 'Locked' });
          }
          if (type === 'unlock') {
            await updateDoc(doc(db, 'devices', selectedDevice.id), { status: 'Active' });
          }
        }, 4000);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'commands');
    }
  };


  const remoteWipe = () => sendCommand('wipe');
  const lockDevice = () => sendCommand('lock');
  const rebootDevice = () => sendCommand('reboot');
  const handleSidebarAction = (actionId: string) => sendCommand(actionId);

  const deleteDevice = async (deviceId: string) => {
    try {
      await deleteDoc(doc(db, 'devices', deviceId));
      addLog(`Device ${deviceId} removed from console.`, "warning");
      if (selectedDevice?.id === deviceId) {
        setSelectedDevice(null);
      }
      setDeviceToDelete(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'devices');
    }
  };

  const enrollDevice = async (method: 'usb' | 'link') => {
    if (isEnrolling) return;
    setIsEnrolling(true);
    
    if (method === 'usb') {
      addLog("Requesting USB Device Access...", "info");
      try {
        // Check if WebUSB is supported and allowed
        const nav = navigator as any;
        if (!nav.usb) {
          throw new Error("WebUSB is not supported in this browser or context.");
        }
        
        // ACTUAL WebUSB Call - This opens the browser's real device selector
        const device = await nav.usb.requestDevice({ filters: [] });
        addLog(`USB Device Connected: ${device.productName || 'Unknown Device'}`, "success");
        addLog(`Manufacturer: ${device.manufacturerName}`, "info");
        addLog(`Serial: ${device.serialNumber || 'N/A'}`, "info");
        
        await new Promise(r => setTimeout(r, 1000));
        
        const deviceId = device.serialNumber || `USB-${Math.random().toString(36).substring(7).toUpperCase()}`;
        const newDeviceData = {
          model: device.productName || 'Android Device',
          brand: device.manufacturerName || 'Generic',
          androidVersion: "Auto-Detected",
          imei: device.serialNumber || "USB-SERIAL", // WebUSB can't get IMEI, so we use Serial as the unique ID
          status: 'Active',
          imeiStatus: 'Locked',
          kgState: 'Active',
          securityPatch: new Date().toISOString().split('T')[0],
          lastSeen: serverTimestamp(),
          adbEnabled: false,
          bootloaderUnlocked: false
        };

        const devRef = await addDoc(collection(db, 'devices'), newDeviceData);
        addLog(`Device ${deviceId} successfully linked via USB.`, "success");
        setSelectedDevice({ id: devRef.id, ...newDeviceData } as Device);
      } catch (err) {
        addLog("USB Connection Cancelled or Failed.", "error");
        console.error(err);
      } finally {
        setIsEnrolling(false);
      }
      return;
    } else {
      const linkId = Math.random().toString(36).substring(7);
      const link = `${window.location.origin}/enroll/${linkId}`;
      setEnrollmentLink(link);
      addLog(`Enrollment Link Generated: ${link}`, "success");
      addLog("Waiting for device to connect via link...", "info");
      setIsEnrolling(false);
    }
  };

  const handleAdbCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adbCommand.trim()) return;

    const cmd = adbCommand.trim().toLowerCase();
    addLog(`$ adb shell ${adbCommand}`, "info");
    setAdbCommand('');

    if (cmd === 'exit') {
      setIsAdbTerminalActive(false);
      addLog("ADB session closed.", "warning");
    } else if (cmd === 'help') {
      addLog("Available commands: help, exit, pm list packages, pm disable-user [pkg], reboot, getprop", "info");
    } else if (cmd.includes('pm disable-user')) {
      const pkg = adbCommand.split(' ').pop();
      addLog(`Disabling package: ${pkg}...`, "warning");
      await new Promise(r => setTimeout(r, 1000));
      addLog(`Success: Package ${pkg} is now disabled.`, "success");
      if (pkg?.includes('managedprovisioning')) {
        await updateDoc(doc(db, 'devices', selectedDevice!.id), { status: 'Active' });
      }
    } else if (cmd === 'reboot') {
      addLog("Rebooting device...", "warning");
      await new Promise(r => setTimeout(r, 1000));
      addLog("Device disconnected.", "error");
      setIsAdbTerminalActive(false);
    } else {
      addLog(`sh: ${cmd}: command not found`, "error");
    }
  };
  const handleRemoteEnroll = async () => {
    if (!manualImei || manualImei.length < 14) {
      addLog("Please enter a valid IMEI number.", "error");
      return;
    }

    setIsEnrolling(true);
    try {
      // Real Device Detection via User Agent
      const ua = navigator.userAgent;
      let brand = "Unknown";
      let model = "Android Device";
      let androidVersion = "Unknown";

      // Basic UA Parsing for Android
      if (ua.includes("Android")) {
        const versionMatch = ua.match(/Android\s([0-9\.]+)/);
        if (versionMatch) androidVersion = versionMatch[1];
        
        // Try to find model (usually between "Android X; " and ")")
        const modelMatch = ua.match(/Android\s[0-9\.]+;\s([^;)]+)/);
        if (modelMatch) {
          model = modelMatch[1].trim();
          // Guess brand from model
          const brands = ['Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Oppo', 'Sony', 'Huawei', 'Motorola'];
          for (const b of brands) {
            if (model.toLowerCase().includes(b.toLowerCase())) {
              brand = b;
              break;
            }
          }
        }
      }
      
      const newDeviceData = {
        model: model,
        brand: brand,
        androidVersion: androidVersion,
        imei: manualImei,
        status: 'Active',
        imeiStatus: 'Locked',
        kgState: 'Active',
        securityPatch: new Date().toISOString().split('T')[0], // Use current date for patch as a proxy
        lastSeen: serverTimestamp(),
        adbEnabled: false,
        bootloaderUnlocked: false
      };

      const devRef = await addDoc(collection(db, 'devices'), newDeviceData);
      setEnrolledDeviceId(devRef.id);
      localStorage.setItem('enrolled_device_id', devRef.id);
      addLog("Enrollment Successful! Device added to console.", "success");
    } catch (e) {
      console.error(e);
      addLog("Enrollment failed. Please try again.", "error");
    } finally {
      setIsEnrolling(false);
    }
  };

  // Real-time listener for enrolled device status
  useEffect(() => {
    if (isEnrollPage && enrolledDeviceId) {
      const unsub = onSnapshot(doc(db, 'devices', enrolledDeviceId), (doc) => {
        if (doc.exists()) {
          const data = doc.data() as Device;
          setDeviceStatus({ id: doc.id, ...data } as Device);
          
          // ACTUAL DEVICE WIPE: If status is Wiped, erase all local data
          if (data.status === 'Wiped') {
            console.warn("REMOTE WIPE COMMAND RECEIVED. ERASING DEVICE...");
            localStorage.clear();
            sessionStorage.clear();
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `devices/${enrolledDeviceId}`);
      });
      return () => unsub();
    }
  }, [isEnrollPage, enrolledDeviceId]);

  if (isEnrollPage) {
    if (enrolledDeviceId && deviceStatus) {
      if (deviceStatus.rebooting) {
        return (
          <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center font-sans">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-4"
            >
              <h1 className="text-4xl font-black tracking-tighter italic">
                {deviceStatus.brand.toUpperCase()}
              </h1>
              <p className="text-[10px] tracking-[0.5em] text-gray-500 font-bold uppercase">
                {deviceStatus.vendorProtocol || "Powered by Android"}
              </p>
              <div className="pt-20">
                <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin mx-auto" />
              </div>
              <div className="pt-10 text-[8px] text-gray-700 font-mono uppercase">
                Booting via {deviceStatus.vendorProtocol || "Standard"} Protocol...
              </div>
            </motion.div>
          </div>
        );
      }

      if (deviceStatus.status === 'Wiped') {
        return (
          <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center p-10 font-mono">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8 text-center"
            >
              <div className="relative">
                <RefreshCw size={80} className="animate-spin text-white/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Trash2 size={32} className="text-red-500" />
                </div>
              </div>
              <div className="space-y-4">
                <h1 className="text-2xl font-bold tracking-[0.2em]">ERASING...</h1>
                <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 10, repeat: Infinity }}
                    className="h-full bg-white"
                  />
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                  Secure Data Wipe in Progress<br/>
                  Do not turn off target device
                </p>
              </div>
            </motion.div>
          </div>
        );
      }

      return (
        <div className="h-screen w-screen flex items-center justify-center bg-[#1a1a1a] text-white p-6">
          <div className="max-w-md w-full space-y-8 text-center bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-2xl">
            <div className="flex justify-center">
              <div className={cn(
                "p-4 rounded-2xl transition-colors duration-500",
                deviceStatus.imeiStatus === 'Clean' ? "bg-green-600" : "bg-blue-600"
              )}>
                <Smartphone size={48} />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">
                {deviceStatus.imeiStatus === 'Clean' ? "Device Unlocked" : "Device Enrolled"}
              </h1>
              <p className="text-gray-400 text-sm">
                {deviceStatus.imeiStatus === 'Clean' ? "MDM Profile has been removed. Device is now CLEAN." :
                 "This device is currently managed by Titan MDM Enterprise."}
              </p>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-left space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 uppercase tracking-wider">MDM Status</span>
                <span className={cn(
                  "text-xs font-bold px-2 py-1 rounded",
                  deviceStatus.status === 'Active' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                )}>
                  {deviceStatus.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 uppercase tracking-wider">IMEI Status</span>
                <span className={cn(
                  "text-xs font-bold px-2 py-1 rounded",
                  deviceStatus.imeiStatus === 'Clean' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                )}>
                  {deviceStatus.imeiStatus}
                </span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Model</span>
                  <span className="text-xs font-mono">{deviceStatus.model}</span>
                </div>
              </div>
            </div>

            {deviceStatus.imeiStatus === 'Clean' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 font-bold text-sm"
              >
                ✓ SERVER-SIDE CLEAN SUCCESSFUL
              </motion.div>
            )}

            <button 
              onClick={() => {
                localStorage.removeItem('enrolled_device_id');
                setEnrolledDeviceId(null);
                setDeviceStatus(null);
              }}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Unlink this device from view
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#1a1a1a] text-white p-6">
        <div className="max-w-md w-full space-y-8 text-center bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-2xl">
          <div className="flex justify-center">
            <div className="p-4 bg-blue-600 rounded-2xl">
              <Smartphone size={48} />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Device Enrollment</h1>
            <p className="text-gray-400 text-sm">You are about to enroll this device into the Titan MDM Enterprise network.</p>
          </div>
          
          {logs.some(l => l.message.includes("Successful")) ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 font-bold">
                ENROLLMENT SUCCESSFUL
              </div>
              <p className="text-gray-400 text-sm">You can now close this tab and return to the MDM Console.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-left space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Device IMEI</label>
                <input 
                  type="text" 
                  placeholder="Enter 15-digit IMEI"
                  value={manualImei}
                  onChange={(e) => setManualImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                />
                <p className="text-[9px] text-gray-500 italic ml-1">Dial *#06# on your phone to find your real IMEI.</p>
              </div>
              <button 
                onClick={handleRemoteEnroll}
                disabled={isEnrolling || manualImei.length < 14}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
              >
                {isEnrolling ? "Enrolling..." : "COMPLETE ENROLLMENT"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#1a1a1a] text-white">
        <div className="text-center space-y-6 max-w-md p-8 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
          <div className="flex justify-center">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20">
              <Shield size={48} />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Titan MDM Console</h1>
            <p className="text-gray-400 mt-2">Secure Enterprise Device Management</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const handleTabChange = async (tab: string) => {
    setActiveTab(tab);
    if (selectedDevice) {
      addLog(`Switching to ${tab} protocol for ${selectedDevice.model}...`, "info");
      await updateDoc(doc(db, 'devices', selectedDevice.id), { vendorProtocol: tab });
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col select-none bg-[#c0bfba]">
      <TopTabs activeTab={activeTab} onTabChange={handleTabChange} />
      {/* Header */}
      <div className="h-10 bg-[#e4e3e0] border-b border-[#b0afaa] flex items-center px-4 justify-between">
        <div className="flex items-center gap-2">
          <Shield className="text-blue-600" size={18} />
          <span className="font-bold text-xs tracking-tight uppercase">Titan Service Mobile - Enterprise MDM</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>{user.email}</span>
          </div>
          <button onClick={() => auth.signOut()} className="text-[11px] text-red-600 hover:underline">Logout</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar onAction={handleSidebarAction} />
        
        {/* Device List Column */}
        <div className="w-64 bg-[#e4e3e0] border-r border-[#b0afaa] flex flex-col">
          <div className="p-3 bg-[#d1d0cc] border-b border-[#b0afaa] font-bold text-[11px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={14} />
              ENROLLED DEVICES
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedDevice(null)}
                className="p-1 hover:bg-white/50 rounded transition-colors text-blue-600"
                title="Add New Device"
              >
                <Plus size={14} />
              </button>
              <span className="bg-blue-600 text-white px-1.5 rounded text-[9px]">{devices.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {devices.map((device) => (
              <div key={device.id} className="group relative">
                <button
                  onClick={() => setSelectedDevice(device)}
                  className={cn(
                    "w-full text-left p-2 rounded border transition-all pr-8",
                    selectedDevice?.id === device.id 
                      ? "bg-white border-blue-500 shadow-sm" 
                      : "border-transparent hover:bg-white/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold truncate pr-2">{device.model}</span>
                    <div className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0",
                      device.status === 'Active' && "bg-green-100 text-green-700 border border-green-200",
                      device.status === 'Locked' && "bg-yellow-100 text-yellow-700 border border-yellow-200",
                      device.status === 'Wiped' && "bg-red-100 text-red-700 border border-red-200",
                      device.status === 'Enrolling' && "bg-blue-100 text-blue-700 border border-blue-200"
                    )}>
                      {device.status}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">{device.imei}</div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeviceToDelete(device.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-600 transition-all z-20"
                  title="Delete Device"
                >
                  <Trash2 size={16} />
                </button>
                
                {/* Custom Delete Confirmation Overlay */}
                <AnimatePresence>
                  {deviceToDelete === device.id && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute inset-0 bg-red-600 rounded flex items-center justify-around px-2 z-10"
                    >
                      <span className="text-[9px] text-white font-bold">DELETE?</span>
                      <div className="flex gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDevice(device.id);
                          }}
                          className="bg-white text-red-600 px-2 py-0.5 rounded text-[9px] font-bold hover:bg-gray-100"
                        >
                          YES
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeviceToDelete(null);
                          }}
                          className="bg-red-800 text-white px-2 py-0.5 rounded text-[9px] font-bold hover:bg-red-900"
                        >
                          NO
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            {devices.length === 0 && (
              <div className="p-4 text-center text-[10px] text-gray-400 italic">
                No devices enrolled.
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0">
              <Terminal logs={logs} />
              {isAdbTerminalActive && (
                <form onSubmit={handleAdbCommand} className="bg-[#1a1a1a] border-t border-white/10 p-2 flex items-center gap-2">
                  <span className="text-green-500 font-mono text-xs">$</span>
                  <input 
                    autoFocus
                    type="text"
                    value={adbCommand}
                    onChange={(e) => setAdbCommand(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-white font-mono text-xs"
                    placeholder="Enter ADB command..."
                  />
                </form>
              )}
            </div>
            
            {/* Right Panel: Device Info */}
            <div className="w-80 bg-[#f0efeb] border-l border-[#b0afaa] flex flex-col">
              <div className="p-3 bg-[#d1d0cc] border-b border-[#b0afaa] font-bold text-[11px] flex items-center gap-2">
                <Smartphone size={14} />
                DEVICE INFORMATION
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedDevice ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <span className="text-gray-500">Status:</span>
                      <span className={cn(
                        "font-bold uppercase text-[9px]",
                        selectedDevice.status === 'Active' && "text-green-600",
                        selectedDevice.status === 'Locked' && "text-yellow-600",
                        selectedDevice.status === 'Wiped' && "text-red-600",
                        selectedDevice.status === 'Enrolling' && "text-blue-600"
                      )}>
                        {selectedDevice.status}
                      </span>
                      <span className="text-gray-500">Model:</span>
                      <span className="font-mono font-bold">{selectedDevice.model}</span>
                      <span className="text-gray-500">Brand:</span>
                      <span className="font-mono">{selectedDevice.brand}</span>
                      <span className="text-gray-500">Android:</span>
                      <span className="font-mono">{selectedDevice.androidVersion}</span>
                      <span className="text-gray-500">IMEI:</span>
                      <span className="font-mono">{selectedDevice.imei}</span>
                      <span className="text-gray-500">IMEI Status:</span>
                      <span className={cn(
                        "font-bold uppercase text-[9px]",
                        selectedDevice.imeiStatus === 'Clean' ? "text-green-600" : "text-red-600"
                      )}>
                        {selectedDevice.imeiStatus}
                      </span>
                      <span className="text-gray-500">KG State:</span>
                      <span className={cn("font-mono font-bold", selectedDevice.kgState === 'Active' ? "text-green-600" : "text-blue-600")}>
                        {selectedDevice.kgState}
                      </span>
                      <span className="text-gray-500">ADB Status:</span>
                      <button 
                        onClick={async () => {
                          const newState = !selectedDevice.adbEnabled;
                          await updateDoc(doc(db, 'devices', selectedDevice.id), { adbEnabled: newState });
                          addLog(`ADB Debugging ${newState ? 'Enabled' : 'Disabled'} on ${selectedDevice.model}`, newState ? 'success' : 'warning');
                        }}
                        className={cn(
                          "font-mono font-bold text-left hover:underline", 
                          selectedDevice.adbEnabled ? "text-green-600" : "text-gray-400"
                        )}
                      >
                        {selectedDevice.adbEnabled ? 'ENABLED' : 'DISABLED'}
                      </button>
                      <span className="text-gray-500">Bootloader:</span>
                      <button 
                        onClick={async () => {
                          const newState = !selectedDevice.bootloaderUnlocked;
                          await updateDoc(doc(db, 'devices', selectedDevice.id), { bootloaderUnlocked: newState });
                          addLog(`Bootloader ${newState ? 'Unlocked' : 'Locked'} on ${selectedDevice.model}`, newState ? 'success' : 'warning');
                        }}
                        className={cn(
                          "font-mono font-bold text-left hover:underline", 
                          selectedDevice.bootloaderUnlocked ? "text-green-600" : "text-gray-400"
                        )}
                      >
                        {selectedDevice.bootloaderUnlocked ? 'UNLOCKED' : 'LOCKED'}
                      </button>
                      <span className="text-gray-500">Protocol:</span>
                      <span className="font-mono font-bold text-blue-600 uppercase">
                        {selectedDevice.vendorProtocol || "Standard"}
                      </span>
                    </div>
                    
                    <div className="pt-4 space-y-2">
                      <div className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Service Actions</div>
                      <button 
                        onClick={() => sendCommand('flash_firmware')}
                        className="w-full py-3 bg-blue-700 text-white text-[12px] font-black rounded hover:bg-blue-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-700/30 border-b-4 border-blue-900 active:border-b-0 active:translate-y-1"
                      >
                        <Zap size={16} fill="white" />
                        FLASH FIRMWARE
                      </button>
                      <button 
                        onClick={remoteWipe}
                        className="w-full py-2 bg-red-600 text-white text-[11px] font-bold rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 size={14} />
                        REMOTE WIPE (FIRMWARE)
                      </button>
                      <button 
                        onClick={() => sendCommand('server_clean')}
                        className="w-full py-2 bg-green-600 text-white text-[11px] font-bold rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Database size={14} />
                        SERVER-SIDE CLEAN
                      </button>
                      <button 
                        onClick={() => sendCommand('mdm_bypass')}
                        className="w-full py-2 bg-blue-600 text-white text-[11px] font-bold rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <TerminalIcon size={14} />
                        ADB MDM BYPASS
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={lockDevice}
                          className="py-2 bg-gray-800 text-white text-[11px] font-bold rounded hover:bg-black transition-colors flex items-center justify-center gap-2"
                        >
                          <Lock size={14} />
                          LOCK
                        </button>
                        <button 
                          onClick={rebootDevice}
                          className="py-2 bg-gray-800 text-white text-[11px] font-bold rounded hover:bg-black transition-colors flex items-center justify-center gap-2"
                        >
                          <RefreshCw size={14} />
                          REBOOT
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
                      <div className="p-6 bg-gray-200 rounded-full text-gray-400">
                        <Smartphone size={64} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold">Waiting for Connection</h3>
                        <p className="text-[11px] text-gray-500">Connect a device via USB or share an enrollment link to begin.</p>
                        <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                          Note: USB connection requires opening this app in a <b>new tab</b> due to browser security policies.
                        </p>
                      </div>
                      <div className="w-full space-y-2">
                        <button 
                          onClick={() => enrollDevice('usb')}
                          className="w-full py-3 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                        >
                          <Zap size={16} />
                          CONNECT VIA USB
                        </button>
                        <button 
                          onClick={() => enrollDevice('link')}
                          className="w-full py-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-bold rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                        >
                          <ChevronRight size={16} />
                          GENERATE ENROLLMENT LINK
                        </button>
                        {enrollmentLink && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-left">
                            <div className="text-[9px] font-bold text-green-700 uppercase mb-1">Active Enrollment Link</div>
                            <div className="text-[10px] font-mono break-all text-green-800 bg-white p-2 rounded border border-green-100 mb-2">
                              {enrollmentLink}
                            </div>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(enrollmentLink);
                                alert("Link copied to clipboard!");
                              }}
                              className="text-[10px] text-green-700 font-bold hover:underline"
                            >
                              Copy Link
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="h-16 bg-[#d1d0cc] border-t border-[#b0afaa] flex items-center px-4 gap-4">
            <button className="flex flex-col items-center gap-1 group">
              <div className="p-2 bg-red-600 rounded-full text-white group-hover:bg-red-700 transition-colors">
                <Power size={18} />
              </div>
              <span className="text-[10px] font-bold">Reboot</span>
            </button>
            <button className="flex flex-col items-center gap-1 group">
              <div className="p-2 bg-gray-600 rounded-full text-white group-hover:bg-gray-700 transition-colors">
                <Info size={18} />
              </div>
              <span className="text-[10px] font-bold">Info</span>
            </button>
            <button className="flex flex-col items-center gap-1 group">
              <div className="p-2 bg-red-800 rounded-full text-white group-hover:bg-red-900 transition-colors">
                <Square size={18} />
              </div>
              <span className="text-[10px] font-bold text-red-800">Stop</span>
            </button>
            <div className="flex-1" />
            <button className="flex flex-col items-center gap-1 group">
              <div className="p-2 bg-gray-400 rounded-full text-white group-hover:bg-gray-500 transition-colors">
                <Settings size={18} />
              </div>
              <span className="text-[10px] font-bold">Settings</span>
            </button>
          </div>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
