package com.gradeloop.iam_service.repository;

import com.gradeloop.iam_service.domain.RefreshToken;
import com.gradeloop.iam_service.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);
    List<RefreshToken> findAllByUserAndRevokedFalse(User user);
    void deleteAllByUser(User user);
}
