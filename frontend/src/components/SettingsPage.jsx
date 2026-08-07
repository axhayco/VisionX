import React, { useState } from 'react'

const REF_RANGES = {
  'Hemoglobin':                { unit: 'g/dL',      min: 12.0,   max: 17.5,   critLow: 8.0,    critHigh: 20.0   },
  'WBC Count':                 { unit: 'cells/mcL', min: 4500,   max: 11000,  critLow: 2000,   critHigh: 30000  },
  'Platelet Count':            { unit: 'cells/mcL', min: 150000, max: 450000, critLow: 50000,  critHigh: 1000000},
  'Glucose (fasting)':         { unit: 'mg/dL',     min: 70,     max: 99,     critLow: 50,     critHigh: 250    },
  'Creatinine':                { unit: 'mg/dL',     min: 0.6,    max: 1.2,    critLow: null,   critHigh: 3.0    },
  'Potassium':                 { unit: 'mEq/L',     min: 3.5,    max: 5.0,    critLow: 3.0,    critHigh: 6.0    },
  'Sodium':                    { unit: 'mEq/L',     min: 135,    max: 145,    critLow: 125,    critHigh: 150    },
  'Blood Pressure (systolic)': { unit: 'mmHg',      min: 90,     max: 120,    critLow: 70,     critHigh: 180    },
}

export default function SettingsPage() {
  const [activeSubTab, setActiveSubTab] = useState('thresholds')
  const [onCallPhysicians, setOnCallPhysicians] = useState([
    { name: 'Dr. Sarah Connor', pager: '555-0199', dept: 'Cardiology', active: true },
    { name: 'Dr. John Doe', pager: '555-4201', dept: 'Hematology', active: true },
    { name: 'Dr. Marcus Vance', pager: '555-9831', dept: 'Emergency Medicine', active: false },
  ])
  const [newPhysician, setNewPhysician] = useState({ name: '', pager: '', dept: '' })

  const handleAddPhysician = (e) => {
    e.preventDefault()
    if (!newPhysician.name || !newPhysician.pager) return
    setOnCallPhysicians([...onCallPhysicians, { ...newPhysician, active: true }])
    setNewPhysician({ name: '', pager: '', dept: '' })
  }

  const togglePhysicianStatus = (index) => {
    const updated = [...onCallPhysicians]
    updated[index].active = !updated[index].active
    setOnCallPhysicians(updated)
  }

  return (
    <div className="settings-page-container card-panel">
      {/* Settings Header */}
      <div className="settings-header">
        <h2>System Configuration & Settings</h2>
        <p>Manage clinical reference ranges, notification targets, and audit paths.</p>
      </div>

      {/* Sub Tabs Toggle */}
      <div className="settings-tabs">
        <button 
          className={`settings-tab-btn ${activeSubTab === 'thresholds' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('thresholds')}
        >
          🔬 Deterministic Reference Ranges
        </button>
        <button 
          className={`settings-tab-btn ${activeSubTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('notifications')}
        >
          🩺 On-Call Clinical Notifications
        </button>
      </div>

      <div className="settings-content-body">
        {activeSubTab === 'thresholds' && (
          <div className="thresholds-settings-view">
            <div className="info-alert-light">
              <strong>Responsible AI Audit Note:</strong> These ranges are deterministic. Any values falling outside the normal ranges automatically flag the report, and critical levels escalate the triage priority instantly.
            </div>

            <div className="table-wrapper-light">
              <table className="settings-table">
                <thead>
                  <tr>
                    <th>Laboratory Parameter</th>
                    <th>Unit</th>
                    <th>Normal Range</th>
                    <th>Critical Low</th>
                    <th>Critical High</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(REF_RANGES).map(([param, range]) => (
                    <tr key={param}>
                      <td className="param-name-cell">{param}</td>
                      <td><code>{range.unit}</code></td>
                      <td>{range.min.toLocaleString()} – {range.max.toLocaleString()}</td>
                      <td className="crit-cell">{range.critLow !== null ? `≤ ${range.critLow.toLocaleString()}` : '—'}</td>
                      <td className="crit-cell">{range.critHigh !== null ? `≥ ${range.critHigh.toLocaleString()}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'notifications' && (
          <div className="notifications-settings-view">
            <div className="info-alert-light">
              Configure which on-call physicians will receive instant triage alerts when the AI pipelines detect Critical and Urgent values.
            </div>

            <div className="physicians-list-section">
              <h3>On-Call Physician Roster</h3>
              <div className="physician-cards-grid">
                {onCallPhysicians.map((phys, idx) => (
                  <div key={idx} className={`physician-card ${phys.active ? 'active-duty' : 'off-duty'}`}>
                    <div className="phys-header">
                      <span className="phys-avatar">👨‍⚕️</span>
                      <div>
                        <h4>{phys.name}</h4>
                        <span className="phys-dept">{phys.dept || 'General Medicine'}</span>
                      </div>
                    </div>
                    <div className="phys-footer">
                      <span className="phys-pager">Pager: <code>{phys.pager}</code></span>
                      <button 
                        className={`toggle-duty-btn ${phys.active ? 'btn-active' : 'btn-inactive'}`}
                        onClick={() => togglePhysicianStatus(idx)}
                      >
                        {phys.active ? 'Active Duty' : 'Off Duty'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Physician Form */}
              <form className="add-physician-form" onSubmit={handleAddPhysician}>
                <h4>Add Physician to Registry</h4>
                <div className="form-row-light">
                  <input 
                    type="text" 
                    placeholder="Physician Name (e.g. Dr. Jane Smith)"
                    value={newPhysician.name}
                    onChange={e => setNewPhysician({ ...newPhysician, name: e.target.value })}
                    required
                  />
                  <input 
                    type="text" 
                    placeholder="Pager ID"
                    value={newPhysician.pager}
                    onChange={e => setNewPhysician({ ...newPhysician, pager: e.target.value })}
                    required
                  />
                  <input 
                    type="text" 
                    placeholder="Department"
                    value={newPhysician.dept}
                    onChange={e => setNewPhysician({ ...newPhysician, dept: e.target.value })}
                  />
                  <button type="submit" className="form-submit-btn">Add Doctor</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
