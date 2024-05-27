class TestFS {
  constructor(data) {
    this.data = data;
  }

  read() {
    return this.data;
  }

  write(fileName, fileContent) {
    alert(JSON.stringify(fileContent));
    return true;
  }
}
