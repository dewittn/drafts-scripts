class Destinations {
  #ui;
  #fs;
  #text;
  #table;
  #settings;
  #data;

  constructor(dependencyProvider) {
    this.#ui = dependencyProvider.ui;
    this.#fs = dependencyProvider.fileSystem;
    this.#table = dependencyProvider.tableName;
    this.#settings = dependencyProvider.settings.destinations;
    this.#text = dependencyProvider.textUltilities;
    this.#data = this.#fs.read(this.#settings.destinationsFile);
  }

  get data() {
    return this.#data[this.#table];
  }

  get keys() {
    return Object.keys(this.data);
  }

  get entries() {
    Object.entries(this.data);
  }

  isValidKey(key) {
    return this.data[key] != undefined;
  }

  getScrubText(key) {
    if (this.isValidKey(key) == false) return undefined;
    const text = this.data[key]["scrubText"];
    return this.data[key]["scrubText"];
  }

  getInfoFromKey(key) {
    const id = this.data[key];
    return id != undefined ? id : { groupID: null };
  }

  getCurrentDestination(testFunction) {
    return this.keys
      .filter((destination) => testFunction(destination))
      .toString();
  }

  select(title = "") {
    const { menuSettings, menuPicker, errorMessage, errorMessage2 } =
      this.#settings;

    menuSettings.menuMessage = title == ""
      ? `${menuSettings.menuMessage} this post.`
      : `${menuSettings.menuMessage}: ${title}`;
    menuPicker["columns"] = [this.keys];
    menuSettings.menuItems.push({ type: "picker", data: menuPicker });

    const choseDestination = this.#ui.buildMenu(menuSettings);

    // Displays prompt and returns chosen Destination
    if (choseDestination.show() == false) {
      return this.#ui.displayAppMessage("error", errorMessage);
    }
    const selectedDestination = choseDestination.fieldValues[menuPicker.name];

    if (selectedDestination == undefined) {
      return this.#ui.displayAppMessage("error", errorMessage2, {
        errorMessage: errorMessage2,
        class: "Destinations",
        function: "select()",
        menuSettings: menuSettings,
        fieldValues: choseDestination.fieldValues,
        selectedDestination: selectedDestination,
      });
    }

    return this.keys[selectedDestination];
  }

  lookupAction(destination) {
    return this.data[destination]?.draftAction;
  }

  lookupTemplate(destination) {
    return this.data[destination]?.template;
  }

  lookupGroupID(destination) {
    return this.data[destination]?.groupID;
  }

  lookupAirTableDestinationName(destination) {
    const errorMessage = "Destination not found!";
    const destData = this.data[destination.toLowerCase()];
    if (destData == undefined) {
      return this.#ui.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "Destinations",
        function: "lookupAirTableDestinationName",
        destination: destination,
        data: this.data,
        destData: destData,
      });
    }

    return destData?.airtableName != undefined
      ? destData.airtableName
      : this.#text.titleCase(destination);
  }

  // Need to rewrite this in order to implement destination actions
  // Specifically the convertDoc logic will need to be changed.
  // Also should create a default action to fire when the status is writing
  lookupDocConvertionData(destination, status = "") {
    const destData = this.data[destination];
    return {
      covertDoc:
        destData?.statusWhenToConvert?.toLowerCase() == status.toLowerCase(),
      newDocType: destData?.convertTo,
    };
  }
}
