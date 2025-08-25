// ==UserScript==
// @name           Opera Sidebar
// @namespace      http://www.zackhotte.com
// @description    Adds a sidebar similar to Opera's, with web panels.
// @include        main
// ==/UserScript==

(function() {
  "use strict";
  console.log('Opera Sidebar Script: Initializing...');

  if (typeof (globalThis.Services) === 'undefined') {
    console.error('Opera Sidebar Script: CRITICAL - globalThis.Services object not found. This script requires a modern Firefox version.');
    return;
  }

  class OperaSidebar {
    constructor() {
      console.log('Opera Sidebar Script: Constructor called.');
      // Use a robust method to run on new windows
      Services.obs.addObserver(this, 'domwindowopened', false);
      this.currentPanelUrl = null;
    }

    observe(subject, topic, data) {
      console.log(`Opera Sidebar Script: Observer triggered for topic: ${topic}`);
      if (topic === 'domwindowopened') {
        subject.addEventListener('load', this.onWindowLoad.bind(this), { once: true });
      }
    }

    onWindowLoad(event) {
      let window = event.currentTarget;
      let document = window.document;
      console.log('Opera Sidebar Script: onWindowLoad triggered.');

      // Only run on browser windows
      if (document.documentElement.getAttribute('windowtype') === 'navigator:browser') {
        console.log('Opera Sidebar Script: Window is a browser, calling createUI.');
        this.createUI(window, document);
      } else {
        console.log('Opera Sidebar Script: Window is not a browser, skipping UI creation.');
      }
    }

    createUI(window, document) {
      console.log('Opera Sidebar Script: createUI function started.');
      // --- Create Sidebar ---
      let sidebar = document.createElement('vbox');
      sidebar.id = 'opera-sidebar';
      sidebar.style.width = '48px';
      sidebar.style.backgroundColor = '#f0f0f0';
      sidebar.style.borderRight = '1px solid #ccc';
      sidebar.style.alignItems = 'center';

      // --- Create "Add" Button ---
      let addButton = document.createElement('toolbarbutton');
      addButton.id = 'opera-sidebar-add-button';
      addButton.setAttribute('label', '+');
      addButton.style.width = '32px';
      addButton.style.height = '32px';
      addButton.style.margin = '8px 0';
      addButton.style.fontSize = '20px';
      addButton.style.fontWeight = 'bold';
      addButton.addEventListener('click', () => {
        this.addSite(window, document);
      }, false);

      sidebar.appendChild(addButton);

      this.renderSiteButtons(window, document);

      // --- Create Splitter ---
      let splitter = document.createElement('splitter');
      splitter.id = 'opera-sidebar-splitter';
      splitter.style.width = '3px';
      splitter.style.borderRight = '1px solid #ccc';
      splitter.hidden = true; // Initially hidden

      // --- Create Web Panel ---
      let panel = document.createElement('browser');
      panel.id = 'opera-sidebar-panel';
      panel.setAttribute('type', 'content');
      panel.setAttribute('flex', '1');
      panel.style.width = '300px';
      panel.hidden = true; // Initially hidden

      // --- Find Insertion Point ---
      const browserHbox = document.getElementById('browser');
      console.log('Opera Sidebar Script: Attempting to find #browser element.');
      if (browserHbox) {
        console.log('Opera Sidebar Script: #browser element found. Inserting UI elements.');
        // Insert at the beginning of the <hbox id="browser">
        browserHbox.insertBefore(panel, browserHbox.firstChild);
        browserHbox.insertBefore(splitter, browserHbox.firstChild);
        browserHbox.insertBefore(sidebar, browserHbox.firstChild);
        console.log('Opera Sidebar Script: UI elements inserted.');
      } else {
        console.error('Opera Sidebar Script: CRITICAL - #browser element not found. Cannot create sidebar.');
      }
    }

    addSite(window, document) {
      const prompts = Services.prompt;
      const title = 'Add a Website';
      const message = 'How do you want to add a website?';
      const choices = ['Add current page', 'Add a custom URL'];
      let selectedIndex = { value: 0 };

      const ok = prompts.select(window, title, message, choices.length, choices, selectedIndex);

      if (ok) {
        if (selectedIndex.value === 0) { // Add current page
          const currentURL = window.gBrowser.currentURI.spec;
          if (currentURL && !currentURL.startsWith('about:')) {
            this.saveAndRender(currentURL, window, document);
          } else {
            Services.prompt.alert(window, 'Cannot Add Page', 'Special pages (like about:newtab) cannot be added.');
          }
        } else { // Add a custom URL
          this.promptForCustomURL(window, document);
        }
      }
    }

    promptForCustomURL(window, document) {
      const prompts = Services.prompt;
      const title = 'Add Custom Website';
      const message = 'Enter the URL of the website to add:';
      let url = { value: 'https://' };

      const ok = prompts.prompt(window, title, message, url, null, {});

      if (ok && url.value && url.value !== 'https://') {
        this.saveAndRender(url.value, window, document);
      }
    }

    saveAndRender(url, window, document) {
      const sites = this.getSites();
      if (!sites.includes(url)) {
        sites.push(url);
        this.saveSites(sites);
        this.renderSiteButtons(window, document);
      } else {
        Services.prompt.alert(window, 'Site Exists', 'This site is already in the sidebar.');
      }
    }

    getSites() {
      try {
        return JSON.parse(Services.prefs.getStringPref('userchrome.operasidebar.sites', '[]'));
      } catch (e) {
        console.error('Opera Sidebar Script: Could not parse sites preference.', e);
        return [];
      }
    }

    saveSites(sites) {
      try {
        Services.prefs.setStringPref('userchrome.operasidebar.sites', JSON.stringify(sites));
      } catch (e) {
        console.error('Opera Sidebar Script: Could not save sites preference.', e);
      }
    }

    renderSiteButtons(window, document) {
      const sidebar = document.getElementById('opera-sidebar');
      if (!sidebar) return;

      const addButton = document.getElementById('opera-sidebar-add-button');

      // Clear existing site buttons
      for (let i = sidebar.childNodes.length - 1; i >= 0; i--) {
        const child = sidebar.childNodes[i];
        if (child.id !== 'opera-sidebar-add-button') {
          sidebar.removeChild(child);
        }
      }

      const sites = this.getSites();
      sites.forEach(url => {
        let button = document.createElement('toolbarbutton');
        button.setAttribute('class', 'opera-sidebar-site-button');
        button.setAttribute('image', `page-icon:${url}`);
        button.setAttribute('tooltiptext', url);
        button.style.width = '32px';
        button.style.height = '32px';
        button.style.margin = '4px 0';
        button.addEventListener('click', () => {
          this.togglePanel(url, document);
        }, false);

        if (addButton) {
          sidebar.insertBefore(button, addButton);
        } else {
          sidebar.appendChild(button);
        }
      });
    }

    togglePanel(url, document) {
      const panel = document.getElementById('opera-sidebar-panel');
      const splitter = document.getElementById('opera-sidebar-splitter');
      if (!panel || !splitter) return;

      if (!panel.hidden && this.currentPanelUrl === url) {
        panel.hidden = true;
        splitter.hidden = true;
        this.currentPanelUrl = null;
        panel.setAttribute('src', 'about:blank');
      } else {
        panel.hidden = false;
        splitter.hidden = false;
        this.currentPanelUrl = url;
        panel.setAttribute('src', url);
      }
    }
  }

  try {
    console.log('Opera Sidebar Script: Instantiating OperaSidebar class.');
    new OperaSidebar();
    console.log('Opera Sidebar Script: Instantiation successful.');
  } catch (e) {
    console.error('Opera Sidebar Script: CRITICAL - Error during class instantiation.', e);
  }

})();
