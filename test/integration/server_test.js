describe("integration tests", function () {
    // We need to wait for a ledger to close
    const TIMEOUT = 20*1000;
    this.timeout(TIMEOUT);
    this.slow(TIMEOUT/2);

    StellarSdk.Network.useTestNetwork();

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function demo() {
        console.log('Taking a break...');
        await sleep(20000);
        console.log('Two second later');
    }

    // Docker
    let server = new StellarSdk.Server('http://127.0.0.1:8000', {allowHttp: true});
    //let server = new StellarSdk.Server('http://192.168.59.103:32773', {allowHttp: true});
    let master = StellarSdk.Keypair.master();
    let accessGiver = StellarSdk.Keypair.random();
    let accessTaker = StellarSdk.Keypair.random();

    //create ids for making signers access
    var randomSignerId = StellarSdk.Keypair.random().publicKey();
    var firstSignerId = StellarSdk.Keypair.random().publicKey();
    var secondSignerId = StellarSdk.Keypair.random().publicKey();


    var signerToAdd = {
        ed25519PublicKey: randomSignerId,
        weight: 50
    };

    var firstSigner = {
        ed25519PublicKey: firstSignerId,
        weight: 10
    };

    var secondSigner = {
        ed25519PublicKey: secondSignerId,
        weight: 10
    };

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

    function giveNewSignersAccess(accessGiver, accessTaker, dateFrames) {
        return server.loadAccount(accessGiver.publicKey())
            .then(source => {
                console.log(source.sequenceNumber());
                console.log(accessGiver.publicKey());
                console.log(accessTaker.publicKey());
                console.log(dateFrames.getTime());
                let tx = new StellarSdk.TransactionBuilder(source)
                    .addOperation(StellarSdk.Operation.giveAccess({
                        friendId: accessTaker.publicKey(),
                        timeFrames: dateFrames,
                        source: accessGiver.publicKey()
                    }))
                    .build();

                tx.sign(accessGiver);

                return server.submitTransaction(tx);
            });
    }

    function addTwoSourceSignersToAccessGiver(firstSigner, secondSigner) {
        return server.loadAccount(accessGiver.publicKey())
            .then(source => {
                let tx = new StellarSdk.TransactionBuilder(source)
                    .addOperation(StellarSdk.Operation.setOptions({
                        signer: firstSigner,
                        source: accessGiver.publicKey()
                    }))
                    .addOperation(StellarSdk.Operation.setOptions({
                        signer: secondSigner,
                        source: accessGiver.publicKey()
                    }))
                    .build();

                tx.sign(accessGiver);

                return server.submitTransaction(tx);
            });
    }

    function setSigners(accessTaker, accessGiver, signerToAdd) {
        return server.loadAccount(accessTaker.publicKey())
            .then(source => {
                console.log(source.sequenceNumber());
                console.log(accessGiver.publicKey());
                console.log(accessTaker.publicKey());
                let tx = new StellarSdk.TransactionBuilder(source)
                    .addOperation(StellarSdk.Operation.setSigners({
                        accessGiverId: accessGiver.publicKey(),
                        signer: signerToAdd,
                        source: accessTaker.publicKey()
                    }))
                    .build();

                tx.sign(accessTaker);

                return server.submitTransaction(tx);
            });
    }

    describe("/transaction", function () {

        it("creates access giver account", function (done) {
            createNewAccount(accessGiver.publicKey())
                .then(result => {
                    expect(result.ledger).to.be.not.null;
                    done();
                })
                .catch(err => console.log(err));
        });

        it("creates access taker account", function (done) {
            createNewAccount(accessTaker.publicKey())
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

        it("submits a new transaction with adding two default signers", function (done) {
            addTwoSourceSignersToAccessGiver(firstSigner, secondSigner)
                .then(result => {
                    done();
                })
                .catch(err => console.log(err));
        });

        it("submits a new transaction with giving signers access", function (done) {
            var dateFrames = new Date(Date.now() + 50);
            giveNewSignersAccess(accessGiver, accessTaker, dateFrames)
                .then(result => {
                    console.log(result);
                    done();
                })
                .catch(err => {console.log(err.extras)});
        });

        it("submits a new transaction with setting signer", function (done) {
            setSigners(accessTaker, accessGiver, signerToAdd)
                .then(result => {
                    console.log(result);
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
