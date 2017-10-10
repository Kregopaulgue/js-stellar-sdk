describe("integration tests", function () {
  // We need to wait for a ledger to close
  const TIMEOUT = 20*1000;
  this.timeout(TIMEOUT);
  this.slow(TIMEOUT/2);

  StellarSdk.Network.useTestNetwork();

  // Docker
  let server = new StellarSdk.Server('http://127.0.0.1:8000', {allowHttp: true});
  //let server = new StellarSdk.Server('http://192.168.59.103:32773', {allowHttp: true});
  let master = StellarSdk.Keypair.master();

  //create ids for making signers access
  var masterId = master.publicKey();
  var accessTakerId = StellarSdk.Keypair.random().publicKey();
  var randomSignerId = StellarSdk.Keypair.random().publicKey();

  var tempSigner = {
      ed25519PublicKey: randomSignerId,
      weight: 50
  }

  before(function(done) {
    this.timeout(60*1000);
    checkConnection(done);
  });

  function checkConnection(done) {
    server.loadAccount(master.publicKey())
      .then(source => {
        console.log('Horizon up and running!');
        done();
      })
      .catch(err => {
        console.log("Couldn't connect to Horizon... Trying again.");
        setTimeout(() => checkConnection(done), 2000);
      });
  }

  function createNewAccount(accountId) {
    return server.loadAccount(master.publicKey())
      .then(source => {
        console.log(source.sequenceNumber());
        let tx = new StellarSdk.TransactionBuilder(source)
          .addOperation(StellarSdk.Operation.createAccount({
            destination: accountId,
            startingBalance: "20000000"
          }))
          .build();

        tx.sign(master);

        return server.submitTransaction(tx);
      });
  }

  function giveNewSignersAccess(accessTakerId) {
      return server.loadAccount(master.publicKey())
          .then(source => {
              console.log(source.sequenceNumber());
              console.log(master.publicKey());
              console.log(accessTakerId);
              let tx = new StellarSdk.TransactionBuilder(source)
                  .addOperation(StellarSdk.Operation.giveAccess({
                        friendId: accessTakerId,
                        source: master.publicKey()
                  }))
                  .build();

              tx.sign(master);

             return server.submitTransaction(tx);
          });
  }

  describe("/transaction", function () {
    it("creates access taker account", function (done) {
      createNewAccount(accessTakerId)
        .then(result => {
          expect(result.ledger).to.be.not.null;
          done();
        })
        .catch(err => console.log(err));
    });

    it("creates temp signer", function (done) {
        createNewAccount(randomSignerId)
            .then(result => {
                expect(result.ledger).to.be.not.null;
                done();
            })
            .catch(err => console.log(err));
    });

    it("submits a new transaction with giving signers access", function (done) {
        giveNewSignersAccess(accessTakerId)
            .then(result => {
                done();
            })
            .catch(err => {console.log(err.extras)});
    });

    it("submits a new transaction with error", function (done) {
      server.loadAccount(master.publicKey())
        .then(source => {
          source.incrementSequenceNumber(); // This will cause an error
          let tx = new StellarSdk.TransactionBuilder(source)
            .addOperation(StellarSdk.Operation.createAccount({
              destination: StellarSdk.Keypair.random().publicKey(),
              startingBalance: "20000000"
            }))
            .build();

          tx.sign(master);

          server.submitTransaction(tx)
            .then(result => done(new Error("This promise should be rejected.")))
            .catch(result => {
              expect(result.extras.result_codes.transaction).to.equal('tx_bad_seq');
              done();
            });
        });
    });
  });

  /*describe("/accounts", function () {
    it("lists all accounts", function (done) {
      server.accounts()
        .call()
        .then(accounts => {
          // The first account should be a master account
          expect(accounts.records[0].account_id).to.equal(master.publicKey());
          done();
        });
    });

    it("stream accounts", function (done) {
      this.timeout(10*1000);
      let randomAccount = StellarSdk.Keypair.random();

      let eventStreamClose = server.accounts()
        .cursor('now')
        .stream({
          onmessage: account => {
            expect(account.account_id).to.equal(randomAccount.publicKey());
            done();
          }
        });

      createNewAccount(randomAccount.publicKey());
      setTimeout(() => eventStreamClose(), 10*1000);
    });
  });*/
});
