class TestDB {
  constructor(data) {
    this.data = data;
  }

  fields() {
    return this;
  }

  maxRecords() {
    return this;
  }

  sort() {
    return this;
  }

  select() {
    return this.data;
  }
}
