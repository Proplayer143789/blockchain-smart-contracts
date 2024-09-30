//! Benchmarking setup for pallet.

use super::*;
use frame_benchmarking::{benchmarks, whitelisted_caller};
use frame_system::RawOrigin;

benchmarks! {
    do_something {
        let caller: T::AccountId = whitelisted_caller();
    }: _(RawOrigin::Signed(caller), 42)
    verify {
        assert_eq!(Something::<T>::get(), Some(42));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use frame_benchmarking::impl_benchmark_test_suite;

    impl_benchmark_test_suite!(Pallet, crate::mock::new_test_ext(), crate::mock::Test);
}