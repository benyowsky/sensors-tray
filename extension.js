import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class SensorsTrayExtension extends Extension {
    enable() {
        this._indicator = new PanelMenu.Button(0.5, 'Sensors Tray Monitor', false);

        this._statusLabel = new St.Label({
            text: '---°C',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'panel-button'
        });
        this._indicator.add_child(this._statusLabel);

        Main.panel.addToStatusArea('sensors-tray-monitor', this._indicator, 1, 'right');

        this._menuContent = new PopupMenu.PopupMenuItem('Pobieranie danych...', { reactive: false });
        this._indicator.menu.addMenuItem(this._menuContent);

        // Odświeżanie danych co 60 sekund, można zmienić ten parametr
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
            this._updateSensorsData();
            return GLib.SOURCE_CONTINUE;
        });

        this._updateSensorsData();
    }

    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }

    async _updateSensorsData() {
        try {
            let proc = new Gio.Subprocess({
                argv: ['sensors'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE
            });
            proc.init(null);

            let [, stdout] = await new Promise((resolve, reject) => {
                proc.communicate_utf8_async(null, null, (obj, res) => {
                    try {
                        resolve(obj.communicate_utf8_finish(res));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            if (stdout && typeof stdout === 'string') {
                this._parseAndDisplay(stdout);
            } else {
                throw new Error('Puste dane wyjściowe z polecenia sensors');
            }
        } catch (err) {
            this._statusLabel.set_text('ERR');
            this._menuContent.label.set_text(`Błąd pobierania danych: ${err.message}`);
        }
    }

    _parseAndDisplay(output) {
        let cpuTempMatch = output.match(/(Package id 0|Core 0|Tctl|CPU):\s+\+?([0-9.]+)°C/);
        
        if (cpuTempMatch && cpuTempMatch[2]) {
            this._statusLabel.set_text(`${Math.round(parseFloat(cpuTempMatch[2]))}°C`);
        } else {
            let genericMatch = output.match(/:\s+\+?([0-9.]+)°C/);
            if (genericMatch) {
                this._statusLabel.set_text(`${Math.round(parseFloat(genericMatch[1]))}°C`);
            } else {
                this._statusLabel.set_text('?°C');
            }
        }

        let cleanLines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');

        this._menuContent.label.set_text(cleanLines);
        this._menuContent.label.set_style('font-family: monospace; font-size: 11px; text-align: left;');
    }
}
