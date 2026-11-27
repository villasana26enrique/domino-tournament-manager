#[cfg(target_os = "windows")]
mod imp {
    #[link(name = "kernel32")]
    extern "system" {
        fn SetThreadExecutionState(es_flags: u32) -> u32;
    }

    const ES_CONTINUOUS: u32 = 0x80000000;
    const ES_SYSTEM_REQUIRED: u32 = 0x00000001;
    const ES_DISPLAY_REQUIRED: u32 = 0x00000002;

    pub fn set_keep_awake(enabled: bool) {
        let flags = if enabled {
            ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
        } else {
            ES_CONTINUOUS
        };
        unsafe {
            SetThreadExecutionState(flags);
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod imp {
    pub fn set_keep_awake(_enabled: bool) {
        // No-op outside Windows; power prevention for projector mode targets Windows laptops
    }
}

pub fn set_keep_awake(enabled: bool) {
    imp::set_keep_awake(enabled);
}
