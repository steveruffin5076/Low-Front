import type { State } from '../../core/StateMachine';
import type { GameContext } from '../../core/GameContext';
import type { Profile } from '../../save/ProfileStore';
import { button, el } from '../dom';
import { LoadoutPanel } from '../profile/LoadoutPanel';
import { ProfilePanel } from '../profile/ProfilePanel';
import { SoldierPreview } from '../profile/SoldierPreview';

/** Profile & Loadout screen (plan section 5.2). Changes are saved as soon as they are valid. */
export class ProfileScreen implements State {
  private root: HTMLElement | null = null;
  private profile!: Profile;
  private soldier: SoldierPreview | null = null;
  private loadout: LoadoutPanel | null = null;
  private deployButton: HTMLButtonElement | null = null;

  constructor(private readonly ctx: GameContext) {}

  enter(): void {
    this.profile = this.ctx.profiles.load();
    this.soldier = new SoldierPreview(this.profile.loadout.primary);
    this.loadout = new LoadoutPanel(this.profile.loadout, (loadout) => {
      this.profile.loadout = loadout;
      this.soldier?.setWeapon(loadout.primary);
      this.save();
    });
    const profilePanel = new ProfilePanel(this.profile.name, this.profile.stats, (name) => {
      if (name !== null) {
        this.profile.name = name;
        this.save();
      }
      if (this.deployButton) this.deployButton.disabled = name === null;
    });
    this.deployButton = button('Deploy', () => this.ctx.changeScreen('loading'), 'btn btn-primary');

    this.root = el('div', { class: 'screen profile-screen' }, [
      el('div', { class: 'profile-columns' }, [profilePanel.element, this.soldier.element, this.loadout.element]),
      el('div', { class: 'bottom-bar' }, [button('Back', () => this.ctx.changeScreen('mainMenu')), this.deployButton]),
    ]);
    this.ctx.ui.append(this.root);
  }

  exit(): void {
    this.soldier?.dispose();
    this.loadout?.dispose();
    this.root?.remove();
    this.root = null;
    this.soldier = null;
    this.loadout = null;
    this.deployButton = null;
  }

  update(dt: number): void {
    this.ctx.backdrop.update(dt);
    this.soldier?.update(dt);
    this.loadout?.update(dt);
  }

  render(): void {
    this.ctx.renderer.render(this.ctx.backdrop.scene, this.ctx.backdrop.camera);
    this.soldier?.draw(this.ctx.preview);
    this.loadout?.draw(this.ctx.preview);
  }

  private save(): void {
    this.ctx.profiles.save(this.profile);
  }
}
