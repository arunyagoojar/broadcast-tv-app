import { useEffect, useRef } from 'react';

const BUTTONS = {
  confirm: 0,
  back: 1,
  fullscreen: 2,
  refresh: 3,
  menu: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

let navigationAudioContext = null;

function playNavigationTick() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    navigationAudioContext ||= new AudioContextClass();

    const emitTick = () => {
      const now = navigationAudioContext.currentTime;
      const oscillator = navigationAudioContext.createOscillator();
      const gain = navigationAudioContext.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(620, now);
      oscillator.frequency.exponentialRampToValueAtTime(430, now + 0.045);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.022, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      oscillator.connect(gain);
      gain.connect(navigationAudioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.055);
    };

    if (navigationAudioContext.state === 'suspended') {
      navigationAudioContext.resume().then(emitTick).catch(() => {});
    } else {
      emitTick();
    }
  } catch {
    // Navigation remains functional if UI audio is unavailable.
  }
}

function getVisibleMenuButtons(root = document) {
  return [...root.querySelectorAll('button:not([disabled])')]
    .filter((button) => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      let ancestor = button;
      while (ancestor && ancestor !== root) {
        const ancestorStyle = getComputedStyle(ancestor);
        if (
          ancestorStyle.visibility === 'hidden' ||
          ancestorStyle.display === 'none' ||
          ancestorStyle.pointerEvents === 'none' ||
          Number(ancestorStyle.opacity) === 0
        ) return false;
        ancestor = ancestor.parentElement;
      }
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
}

function getNavigableMenuButtons() {
  const openMenu = document.querySelector('.left-menu-container.open');
  if (!openMenu) return [];
  const activePage = openMenu.querySelector('[data-menu-page="active"]');
  const menuLevel = activePage?.getAttribute('data-menu-level');
  let buttons;

  if (menuLevel === 'channels') {
    buttons = [
      ...getVisibleMenuButtons(activePage),
      ...getVisibleMenuButtons(openMenu.querySelector('.left-menu-footer')),
    ];
  } else if (menuLevel === 'categories') {
    buttons = [
      ...getVisibleMenuButtons(openMenu.querySelector('.left-menu-header')),
      ...getVisibleMenuButtons(activePage),
      ...getVisibleMenuButtons(openMenu.querySelector('.left-menu-footer')),
    ];
  } else {
    buttons = getVisibleMenuButtons(openMenu);
  }

  return buttons.filter((button) => {
    const label = button.getAttribute('aria-label') || button.textContent || '';
    return !label.includes('Back to') && label !== 'Close settings' && label !== 'Open controls';
  });
}

function showMenuSelection(button) {
  document.querySelectorAll('.menu-nav-selected').forEach((element) => {
    element.classList.remove('menu-nav-selected');
  });
  if (!button) return;
  button.classList.add('menu-nav-selected');
  button.focus({ preventScroll: true });
  button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export function useGamepadNavigation({ disabled, menuOpen, onNextChannel, onPreviousChannel, onFullscreen, onRefresh, onToggleMenu, onBack }) {
  const previousButtonsRef = useRef({});
  const previousAxesRef = useRef({ horizontal: 0, vertical: 0 });
  const controllerConnectedRef = useRef(false);

  useEffect(() => {
    let animationFrame = null;

    const moveMenuFocus = (direction, withSound = false) => {
      const buttons = getNavigableMenuButtons();
      if (!buttons.length) return;
      const currentIndex = buttons.indexOf(document.activeElement);
      const nextIndex = currentIndex < 0
        ? 0
        : (currentIndex + direction + buttons.length) % buttons.length;
      showMenuSelection(buttons[nextIndex]);
      if (withSound) playNavigationTick();
    };

    const ensureMenuFocus = () => {
      const buttons = getNavigableMenuButtons();
      if (!buttons.length) return;
      const focused = buttons.includes(document.activeElement) ? document.activeElement : null;
      const active = buttons.find((button) => button.classList.contains('active'));
      showMenuSelection(focused || active || buttons[0]);
    };

    const activateSelection = () => {
      const buttons = getNavigableMenuButtons();
      const selected = buttons.includes(document.activeElement) ? document.activeElement : null;
      if (!selected) {
        ensureMenuFocus();
        return;
      }
      selected.click();
      window.setTimeout(ensureMenuFocus, 50);
    };

    const goBack = () => {
      const backButton = getVisibleMenuButtons().find((button) => {
        const label = button.getAttribute('aria-label') || button.textContent || '';
        return label.includes('Back to');
      });
      if (backButton) {
        backButton.click();
        window.setTimeout(ensureMenuFocus, 50);
      } else {
        onBack();
      }
    };

    const pressedOnce = (gamepad, name) => {
      const index = BUTTONS[name];
      const pressed = Boolean(gamepad?.buttons?.[index]?.pressed);
      const wasPressed = Boolean(previousButtonsRef.current[name]);
      previousButtonsRef.current[name] = pressed;
      return pressed && !wasPressed;
    };

    const poll = () => {
      if (disabled) {
        previousButtonsRef.current = {};
        previousAxesRef.current = { horizontal: 0, vertical: 0 };
        animationFrame = requestAnimationFrame(poll);
        return;
      }
      const gamepad = [...(navigator.getGamepads?.() || [])].find(Boolean);
      if (gamepad) {
        if (!controllerConnectedRef.current && menuOpen) {
          window.setTimeout(ensureMenuFocus, 0);
        }
        controllerConnectedRef.current = true;
        const horizontalAxis = Math.abs(gamepad.axes?.[0] || 0) > 0.55
          ? Math.sign(gamepad.axes[0])
          : 0;
        const verticalAxis = Math.abs(gamepad.axes?.[1] || 0) > 0.55
          ? Math.sign(gamepad.axes[1])
          : 0;
        const horizontalMoved = horizontalAxis !== 0 && previousAxesRef.current.horizontal === 0;
        const verticalMoved = verticalAxis !== 0 && previousAxesRef.current.vertical === 0;
        previousAxesRef.current = { horizontal: horizontalAxis, vertical: verticalAxis };

        if (pressedOnce(gamepad, 'menu')) onToggleMenu();
        if (pressedOnce(gamepad, 'fullscreen')) onFullscreen();
        if (pressedOnce(gamepad, 'refresh')) onRefresh();

        if (menuOpen) {
          if (pressedOnce(gamepad, 'up') || (verticalMoved && verticalAxis < 0)) moveMenuFocus(-1, true);
          if (pressedOnce(gamepad, 'down') || (verticalMoved && verticalAxis > 0)) moveMenuFocus(1, true);
          pressedOnce(gamepad, 'left');
          pressedOnce(gamepad, 'right');
          if (pressedOnce(gamepad, 'back')) goBack();
          if (pressedOnce(gamepad, 'confirm')) activateSelection();
        } else {
          if (pressedOnce(gamepad, 'left') || (horizontalMoved && horizontalAxis < 0)) onPreviousChannel();
          if (pressedOnce(gamepad, 'right') || (horizontalMoved && horizontalAxis > 0)) onNextChannel();
        }
      } else {
        if (controllerConnectedRef.current) {
          document.querySelectorAll('.menu-nav-selected').forEach((element) => {
            element.classList.remove('menu-nav-selected');
          });
          if (document.activeElement?.closest?.('.left-menu-container.open')) {
            document.activeElement.blur();
          }
        }
        controllerConnectedRef.current = false;
        previousButtonsRef.current = {};
        previousAxesRef.current = { horizontal: 0, vertical: 0 };
      }

      animationFrame = requestAnimationFrame(poll);
    };

    const handleKeyDown = (event) => {
      if (disabled || !menuOpen) return;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveMenuFocus(-1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveMenuFocus(1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateSelection();
      } else if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        goBack();
      }
    };

    const connectedGamepad = [...(navigator.getGamepads?.() || [])].find(Boolean);
    controllerConnectedRef.current = Boolean(connectedGamepad);
    if (!disabled && menuOpen && connectedGamepad) window.setTimeout(ensureMenuFocus, 0);
    document.addEventListener('keydown', handleKeyDown);
    animationFrame = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(animationFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.querySelectorAll('.menu-nav-selected').forEach((element) => element.classList.remove('menu-nav-selected'));
    };
  }, [disabled, menuOpen, onBack, onFullscreen, onNextChannel, onPreviousChannel, onRefresh, onToggleMenu]);
}
