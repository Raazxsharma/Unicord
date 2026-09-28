import re
import os

DIR = os.path.dirname(os.path.abspath(__file__))

# 1. Update js/ui.js to add openEditProfileModal and live preview updater
ui_path = os.path.join(DIR, 'js', 'ui.js')
with open(ui_path, 'r', encoding='utf-8') as f:
    ui_code = f.read()

edit_profile_ui_method = '''
  openEditProfileModal() {
    const modal = document.getElementById('modal-edit-profile');
    if (!modal) return;

    const me = window.stateManager.state.currentUser;

    // Populate inputs
    const inputName = document.getElementById('edit-display-name');
    const selectRole = document.getElementById('edit-student-role');
    const inputStatus = document.getElementById('edit-custom-status');
    const inputBanner = document.getElementById('edit-banner-color');
    const inputBio = document.getElementById('edit-bio');

    if (inputName) inputName.value = me.name || '';
    if (selectRole) selectRole.value = me.role || 'BBA Student';
    if (inputStatus) inputStatus.value = me.customStatus || '';
    if (inputBanner) inputBanner.value = me.bannerColor || '#5865F2';
    if (inputBio) inputBio.value = me.bio || '';

    // Selected swatch
    document.querySelectorAll('#edit-avatar-swatches .avatar-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color === me.avatarBg);
    });

    this.updateLiveProfilePreview();
    modal.style.display = 'flex';
  }

  updateLiveProfilePreview() {
    const inputName = document.getElementById('edit-display-name');
    const selectRole = document.getElementById('edit-student-role');
    const inputStatus = document.getElementById('edit-custom-status');
    const inputBanner = document.getElementById('edit-banner-color');
    const inputBio = document.getElementById('edit-bio');

    const prevName = document.getElementById('live-prev-name');
    const prevRole = document.getElementById('live-prev-role');
    const prevStatus = document.getElementById('live-prev-status');
    const prevBanner = document.getElementById('live-prev-banner');
    const prevBio = document.getElementById('live-prev-bio');
    const prevAvatar = document.getElementById('live-prev-avatar');

    const me = window.stateManager.state.currentUser;
    const nameVal = (inputName && inputName.value.trim()) || me.name;
    const roleVal = (selectRole && selectRole.value) || me.role;
    const statusVal = (inputStatus && inputStatus.value.trim()) || me.customStatus;
    const bannerVal = (inputBanner && inputBanner.value) || me.bannerColor || '#5865F2';
    const bioVal = (inputBio && inputBio.value.trim()) || me.bio;

    if (prevName) prevName.textContent = nameVal;
    if (prevRole) prevRole.textContent = roleVal;
    if (prevStatus) prevStatus.textContent = statusVal;
    if (prevBanner) prevBanner.style.backgroundColor = bannerVal;
    if (prevBio) prevBio.textContent = bioVal;

    if (prevAvatar) {
      if (me.avatarPhoto) {
        prevAvatar.style.backgroundImage = `url(${me.avatarPhoto})`;
        prevAvatar.textContent = '';
      } else {
        prevAvatar.style.backgroundImage = 'none';
        prevAvatar.style.backgroundColor = me.avatarBg || '#5865F2';
        prevAvatar.textContent = nameVal.substring(0, 2).toUpperCase();
      }
    }
  }
'''

if 'openEditProfileModal()' not in ui_code:
    # Insert right before the last closing brace of UIController class
    last_brace_idx = ui_code.rfind('}')
    ui_code = ui_code[:last_brace_idx] + edit_profile_ui_method + '\n}\n'
    with open(ui_path, 'w', encoding='utf-8') as f:
        f.write(ui_code)
    print('[SUCCESS] Added openEditProfileModal and updateLiveProfilePreview to js/ui.js')

# 2. Update js/app.js to hook up modal events and live preview input handlers
app_path = os.path.join(DIR, 'js', 'app.js')
with open(app_path, 'r', encoding='utf-8') as f:
    app_code = f.read()

edit_profile_app_events = '''
  // --- EDIT PROFILE MODAL HANDLERS ---
  const modalEditProfile = document.getElementById('modal-edit-profile');
  const btnOpenEditProfile = document.getElementById('btn-open-edit-profile');
  const btnCloseEditProfile = document.getElementById('close-edit-profile-modal');
  const btnCancelEditProfile = document.getElementById('cancel-edit-profile');
  const btnSaveEditProfile = document.getElementById('save-edit-profile');

  const inputEditName = document.getElementById('edit-display-name');
  const selectEditRole = document.getElementById('edit-student-role');
  const inputEditStatus = document.getElementById('edit-custom-status');
  const inputEditBanner = document.getElementById('edit-banner-color');
  const inputEditBio = document.getElementById('edit-bio');
  const avatarFileInput = document.getElementById('edit-avatar-file-input');
  const btnUploadAvatarFile = document.getElementById('btn-upload-avatar-file');
  const btnRemoveAvatarPhoto = document.getElementById('btn-remove-avatar-photo');

  if (btnOpenEditProfile) {
    btnOpenEditProfile.onclick = (e) => {
      e.stopPropagation();
      window.uiController.openEditProfileModal();
    };
  }

  // Open from status menu
  const statusOptEdit = document.getElementById('status-opt-edit-profile');
  if (statusOptEdit) {
    statusOptEdit.onclick = () => {
      const statusMenu = document.getElementById('status-menu');
      if (statusMenu) statusMenu.style.display = 'none';
      window.uiController.openEditProfileModal();
    };
  }

  const hideEditProfileModal = () => {
    if (modalEditProfile) modalEditProfile.style.display = 'none';
  };
  if (btnCloseEditProfile) btnCloseEditProfile.onclick = hideEditProfileModal;
  if (btnCancelEditProfile) btnCancelEditProfile.onclick = hideEditProfileModal;

  // Real-time Live Preview Updates as user types
  [inputEditName, selectEditRole, inputEditStatus, inputEditBanner, inputEditBio].forEach(input => {
    if (input) {
      input.addEventListener('input', () => window.uiController.updateLiveProfilePreview());
      input.addEventListener('change', () => window.uiController.updateLiveProfilePreview());
    }
  });

  // Avatar Swatches click
  document.querySelectorAll('#edit-avatar-swatches .avatar-swatch').forEach(sw => {
    sw.onclick = () => {
      document.querySelectorAll('#edit-avatar-swatches .avatar-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      window.stateManager.state.currentUser.avatarBg = sw.dataset.color;
      window.uiController.updateLiveProfilePreview();
    };
  });

  // Photo upload
  if (btnUploadAvatarFile && avatarFileInput) {
    btnUploadAvatarFile.onclick = () => avatarFileInput.click();
    avatarFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        window.stateManager.state.currentUser.avatarPhoto = event.target.result;
        if (btnRemoveAvatarPhoto) btnRemoveAvatarPhoto.style.display = 'inline-block';
        window.uiController.updateLiveProfilePreview();
      };
      reader.readAsDataURL(file);
    };
  }

  if (btnRemoveAvatarPhoto) {
    btnRemoveAvatarPhoto.onclick = () => {
      window.stateManager.state.currentUser.avatarPhoto = null;
      btnRemoveAvatarPhoto.style.display = 'none';
      if (avatarFileInput) avatarFileInput.value = '';
      window.uiController.updateLiveProfilePreview();
    };
  }

  // Save Changes
  if (btnSaveEditProfile) {
    btnSaveEditProfile.onclick = () => {
      const me = window.stateManager.state.currentUser;
      if (inputEditName) me.name = inputEditName.value.trim() || 'Student';
      if (selectEditRole) me.role = selectEditRole.value;
      if (inputEditStatus) me.customStatus = inputEditStatus.value.trim();
      if (inputEditBanner) me.bannerColor = inputEditBanner.value;
      if (inputEditBio) me.bio = inputEditBio.value.trim();
      me.avatarText = me.name.substring(0, 2).toUpperCase();

      window.stateManager.saveState();
      hideEditProfileModal();

      // Update UI components immediately
      window.uiController.renderUserBar();
      window.uiController.renderVoiceStage();
      window.uiController.renderMembers();

      // Play success chime
      window.audioEngine.playMessagePing();
    };
  }
'''

if 'modalEditProfile' not in app_code:
    # Insert right before the last closing brace
    last_brace_idx = app_code.rfind('});')
    if last_brace_idx != -1:
        app_code = app_code[:last_brace_idx] + edit_profile_app_events + '\n});\n'
    else:
        app_code += edit_profile_app_events
    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(app_code)
    print('[SUCCESS] Added edit profile event listeners to js/app.js')
