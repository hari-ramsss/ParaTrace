TARGETS = all clean
.PHONY: $(TARGETS)
.SILENT: $(TARGETS)

all:
	# RUSTC_BOOTSTRAP is required in order to use unstable features
	RUSTC_BOOTSTRAP=1 cargo build --release \
		--target $(CURDIR)/riscv64emac-unknown-none-polkavm.json \
		-Z build-std=core
	polkatool link --strip --output contract.polkavm target/riscv64emac-unknown-none-polkavm/release/contract.elf

clean:
	cargo clean
