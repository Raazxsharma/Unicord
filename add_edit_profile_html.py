import re
import os

DIR = os.path.dirname(os.path.abspath(__file__))
index_path = os.path.join(DIR, 'index.html')

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add Edit Profile pencil icon into user-summary
pencil_button_html = '''        <button class="user-edit-pencil-btn" id="btn-open-edit-profile" data-tooltip="Edit Profile" aria-label="Edit Profile">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>'''

if 'btn-open-edit-profile' not in html:
    # Insert right inside user-summary before user-controls
    target = '</div>\n        </div>\n\n        <div class="user-controls">'
    replacement = f'</div>\n{pencil_button_html}\n        </div>\n\n        <div class="user-controls">'
    html = html.replace(target, replacement)
    print('[SUCCESS] Added pencil button to user summary bar')

# 2. Add Edit Profile option into status-menu-popover
status_edit_opt = '''    <div class="status-option" id="status-opt-edit-profile" style="color: var(--brand); font-weight: 600;">
      <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      <div class="status-details">
        <div class="status-title">Edit Profile</div>
      </div>
    </div>
    <div class="menu-divider"></div>\n'''

if 'status-opt-edit-profile' not in html:
    target_status = '<div class="status-menu-popover" id="status-menu" style="display: none;">'
    html = html.replace(target_status, target_status + '\n' + status_edit_opt)
    print('[SUCCESS] Added Edit Profile option to status menu')

# 3. Add modal-edit-profile markup before modal-add-server
edit_profile_modal_markup = '''  <!-- 8. Edit Profile Modal -->
  <div class="modal-backdrop" id="modal-edit-profile" style="display: none;">
    <div class="modal-dialog edit-profile-dialog">
      <button class="modal-close-btn" id="close-edit-profile-modal">&times;</button>
      <div class="modal-header">
        <h2>Edit User Profile</h2>
        <p>Customize how you appear across campus, in channels, and in voice rooms.</p>
      </div>
      <div class="modal-body">
        <div class="edit-profile-grid">
          <!-- Left Column: Form -->
          <div class="edit-profile-form">
            <div class="form-group">
              <label class="form-label" for="edit-display-name">DISPLAY NAME</label>
              <input type="text" class="form-input" id="edit-display-name" placeholder="Your Name or Nickname" />
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-student-role">CAMPUS ROLE / TAG</label>
              <select class="form-input" id="edit-student-role" style="background-color: var(--bg-user-bar); color: var(--text-normal); height: 40px; border-radius: 4px; padding: 0 10px;">
                <option value="BBA Student">🎓 BBA Student</option>
                <option value="Hosteller - Block A">🏢 Hosteller - Block A</option>
                <option value="Hosteller - Block B">🏢 Hosteller - Block B</option>
                <option value="Hosteller - Block C">🏢 Hosteller - Block C</option>
                <option value="Day Scholar - Metro">🚗 Day Scholar - Metro Commuter</option>
                <option value="Class Representative (CR)">⭐ Class Representative (CR)</option>
                <option value="Tech / Coding Club">💻 Tech / Coding Club</option>
                <option value="Design & Media">🎨 Design & Media Society</option>
                <option value="Sports Squad">⚽ Sports Squad</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-custom-status">CUSTOM STATUS</label>
              <input type="text" class="form-input" id="edit-custom-status" placeholder="What's on your mind? (e.g. Studying for exams 📚)" />
            </div>

            <div class="form-group">
              <label class="form-label">AVATAR COLOR</label>
              <div class="avatar-color-swatches" id="edit-avatar-swatches">
                <div class="avatar-swatch active" style="background-color: #5865F2;" data-color="#5865F2"></div>
                <div class="avatar-swatch" style="background-color: #23a55a;" data-color="#23a55a"></div>
                <div class="avatar-swatch" style="background-color: #f0b232;" data-color="#f0b232"></div>
                <div class="avatar-swatch" style="background-color: #eb459e;" data-color="#eb459e"></div>
                <div class="avatar-swatch" style="background-color: #f23f43;" data-color="#f23f43"></div>
                <div class="avatar-swatch" style="background-color: #00a8fc;" data-color="#00a8fc"></div>
              </div>
              <div class="avatar-upload-row">
                <button type="button" class="btn-upload-avatar" id="btn-upload-avatar-file">Upload Photo</button>
                <input type="file" id="edit-avatar-file-input" style="display: none;" accept="image/*">
                <button type="button" class="btn-secondary" id="btn-remove-avatar-photo" style="font-size: 12px; padding: 4px 8px; display: none;">Remove Photo</button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-banner-color">PROFILE BANNER COLOR</label>
              <div class="color-picker-row" style="display: flex; align-items: center; gap: 10px;">
                <input type="color" id="edit-banner-color" value="#5865F2" style="border: none; width: 36px; height: 36px; cursor: pointer; border-radius: 4px;" />
                <span style="font-size: 13px; color: var(--text-muted);">Choose profile card banner color</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-bio">ABOUT ME</label>
              <textarea class="form-textarea" id="edit-bio" rows="3" placeholder="Tell classmates about yourself, courses, or hobbies..."></textarea>
            </div>
          </div>

          <!-- Right Column: Live Discord Card Preview -->
          <div class="edit-profile-preview-col">
            <label class="form-label">LIVE PREVIEW</label>
            <div class="edit-preview-card">
              <div class="edit-preview-banner" id="live-prev-banner"></div>
              <div class="edit-preview-avatar-wrap">
                <div class="edit-preview-avatar" id="live-prev-avatar">AB</div>
                <div class="status-indicator online" id="live-prev-status-dot"></div>
              </div>
              <div class="edit-preview-body">
                <div class="edit-preview-name" id="live-prev-name">Aarav (BBA)</div>
                <div class="edit-preview-role-pill" id="live-prev-role">🎓 BBA Student</div>
                <div class="edit-preview-status" id="live-prev-status">Prepping for BBA presentation 📚</div>
                <div class="edit-preview-bio" id="live-prev-bio">BBA 2nd Year student @ Apex University.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" id="cancel-edit-profile">Cancel</button>
        <button class="btn-primary" id="save-edit-profile">Save Changes</button>
      </div>
    </div>
  </div>\n'''

if 'modal-edit-profile' not in html:
    target_modal = '<!-- 5. Create Server Modal -->'
    html = html.replace(target_modal, edit_profile_modal_markup + '\n  ' + target_modal)
    print('[SUCCESS] Added modal-edit-profile markup to index.html')

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)
